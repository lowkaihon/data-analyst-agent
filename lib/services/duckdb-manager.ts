import * as duckdb from "@duckdb/duckdb-wasm"
import { QueryResult } from "@/lib/tools/types"

// SQL validation constants
const ALLOWED_SQL_PATTERN = /^\s*(SELECT|WITH|PRAGMA)/i
const FORBIDDEN_KEYWORDS = [
  "DROP",
  "INSERT",
  "UPDATE",
  "DELETE",
  "ALTER",
  "CREATE TABLE",
  "TRUNCATE",
]

/**
 * Validates that a SQL query is read-only
 */
export function validateQuery(query: string): { valid: boolean; error?: string } {
  // Check if query starts with allowed commands
  if (!ALLOWED_SQL_PATTERN.test(query)) {
    return {
      valid: false,
      error: "Only SELECT, WITH, and PRAGMA queries are allowed",
    }
  }

  // Check for forbidden keywords
  const upperQuery = query.toUpperCase()
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (upperQuery.includes(keyword)) {
      return {
        valid: false,
        error: `Forbidden keyword detected: ${keyword}. Only read-only queries are allowed.`,
      }
    }
  }

  return { valid: true }
}

/**
 * DuckDB connection manager for executing queries
 */
export class DuckDBManager {
  private db: duckdb.AsyncDuckDB | null = null
  private connection: duckdb.AsyncDuckDBConnection | null = null

  /**
   * Initialize DuckDB instance
   */
  async initialize(): Promise<void> {
    if (this.db) return // Already initialized

    const bundle = await duckdb.selectBundle({
      mvp: {
        mainModule: "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm",
        mainWorker: "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js",
      },
      eh: {
        mainModule: "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm",
        mainWorker: "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js",
      },
    })

    const worker = new Worker(bundle.mainWorker!)
    const logger = new duckdb.ConsoleLogger()
    this.db = new duckdb.AsyncDuckDB(logger, worker)
    await this.db.instantiate(bundle.mainModule!)

    this.connection = await this.db.connect()
  }

  /**
   * Load CSV data into a table
   */
  async loadCSV(tableName: string, csvData: string): Promise<void> {
    if (!this.connection) {
      throw new Error("DuckDB not initialized. Call initialize() first.")
    }

    // Insert CSV data
    await this.connection.insertCSVFromPath(csvData, {
      name: tableName,
      detect: true,
      header: true,
    })
  }

  /**
   * Execute a SQL query with timeout protection
   */
  async executeQuery(
    query: string,
    maxRows: number = 1000,
    timeoutMs: number = 30000,
  ): Promise<QueryResult> {
    if (!this.connection) {
      throw new Error("DuckDB not initialized. Call initialize() first.")
    }

    // Validate query is read-only
    const validation = validateQuery(query)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const startTime = Date.now()

    // Add LIMIT if not present
    let finalQuery = query.trim()
    if (!finalQuery.toUpperCase().includes("LIMIT")) {
      finalQuery += ` LIMIT ${maxRows}`
    }

    // Execute with timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Query timeout exceeded")), timeoutMs),
    )

    const queryPromise = this.connection.query(finalQuery)

    const result = await Promise.race([queryPromise, timeoutPromise])

    const executionTimeMs = Date.now() - startTime

    // Convert to our QueryResult format
    const columns = result.schema.fields.map((field) => field.name)
    const rows = result.toArray().map((row) => Object.values(row))

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs,
    }
  }

  /**
   * Get table schema information
   */
  async getTableSchema(tableName: string): Promise<Array<{ name: string; type: string }>> {
    if (!this.connection) {
      throw new Error("DuckDB not initialized. Call initialize() first.")
    }

    const result = await this.connection.query(
      `PRAGMA table_info('${tableName.replace(/'/g, "''")}')`,
    )

    return result.toArray().map((row: any) => ({
      name: row.name,
      type: row.type,
    }))
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close()
      this.connection = null
    }
    if (this.db) {
      await this.db.terminate()
      this.db = null
    }
  }
}

// Singleton instance for server-side usage
let dbInstance: DuckDBManager | null = null

export function getDuckDBInstance(): DuckDBManager {
  if (!dbInstance) {
    dbInstance = new DuckDBManager()
  }
  return dbInstance
}
