import * as duckdb from "@duckdb/duckdb-wasm"

let dbInstance: duckdb.AsyncDuckDB | null = null
let initPromise: Promise<duckdb.AsyncDuckDB> | null = null

/**
 * Initialize DuckDB-WASM with inline worker creation
 * Returns a singleton instance with proper promise caching
 */
export async function getDB(): Promise<duckdb.AsyncDuckDB> {
  if (dbInstance) return dbInstance

  if (initPromise) return initPromise

  initPromise = (async () => {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()

    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)

    const worker = new Worker(
      URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], {
          type: "text/javascript",
        }),
      ),
    )

    const logger = new duckdb.ConsoleLogger()
    const db = new duckdb.AsyncDuckDB(logger, worker)
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker)

    dbInstance = db
    return db
  })()

  return initPromise
}

/**
 * Load CSV file into DuckDB table
 */
export async function loadCSV(db: duckdb.AsyncDuckDB, file: File, tableName = "t_raw"): Promise<void> {
  const conn = await db.connect()
  try {
    // Register the file
    await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true)

    // Create table from CSV
    await conn.query(`
      CREATE OR REPLACE TABLE ${tableName} AS 
      SELECT * FROM read_csv_auto('${file.name}', 
        header=true, 
        ignore_errors=true,
        max_line_size=1048576
      )
    `)
  } finally {
    await conn.close()
  }
}

/**
 * Convert BigInt values to Numbers for JSON serialization
 */
function convertBigIntToNumber(value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number(value)
  }
  if (Array.isArray(value)) {
    return value.map(convertBigIntToNumber)
  }
  if (value && typeof value === "object") {
    const converted: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      converted[key] = convertBigIntToNumber(val)
    }
    return converted
  }
  return value
}

/**
 * Execute a SQL query with timeout and result limit
 * Returns query results along with execution time in milliseconds
 */
export async function executeQuery(
  db: duckdb.AsyncDuckDB,
  sql: string,
  timeoutMs = 30000,
  maxRows = 1000,
): Promise<{ columns: string[]; rows: unknown[][]; executionTimeMs: number }> {
  const conn = await db.connect()
  const startTime = performance.now()

  try {
    // Add LIMIT if not present
    const limitedSQL = sql.trim().match(/LIMIT\s+\d+/i) ? sql : `${sql} LIMIT ${maxRows}`

    // Execute with timeout
    const result = await Promise.race([
      conn.query(limitedSQL),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Query timeout")), timeoutMs)),
    ])

    const columns = result.schema.fields.map((f) => f.name)
    const rows = result.toArray().map((row) => Object.values(row).map(convertBigIntToNumber))
    const executionTimeMs = Math.round(performance.now() - startTime)

    return { columns, rows, executionTimeMs }
  } finally {
    await conn.close()
  }
}

/**
 * Get table schema
 */
export async function getSchema(db: duckdb.AsyncDuckDB, tableName: string): Promise<{ name: string; type: string }[]> {
  const conn = await db.connect()
  try {
    const result = await conn.query(`PRAGMA table_info('${tableName}')`)
    return result.toArray().map((row: any) => ({
      name: row.name,
      type: row.type,
    }))
  } finally {
    await conn.close()
  }
}
