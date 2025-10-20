import type { AsyncDuckDB } from "@duckdb/duckdb-wasm"

/**
 * Two-stage date parsing:
 * 1. Name heuristic to identify candidate columns
 * 2. Sample-based validation (≥80% parse success)
 */

const DATE_NAME_PATTERNS = ["date", "time", "timestamp", "dt", "created", "updated", "year", "month", "day"]

/**
 * Check if column name suggests it might contain dates
 */
function isDateCandidate(columnName: string): boolean {
  const lower = columnName.toLowerCase()
  return DATE_NAME_PATTERNS.some((pattern) => lower.includes(pattern))
}

/**
 * Try to parse a column as date and return success rate
 */
async function testDateParsing(
  db: AsyncDuckDB,
  tableName: string,
  columnName: string,
  sampleSize = 10000,
): Promise<number> {
  const conn = await db.connect()
  try {
    // Count total non-null values
    const totalResult = await conn.query(`
      SELECT COUNT(*) as total
      FROM ${tableName}
      WHERE "${columnName}" IS NOT NULL
      LIMIT ${sampleSize}
    `)
    const total = totalResult.toArray()[0].total as number

    if (total === 0) return 0

    // Try to parse as timestamp and count successes
    const parseResult = await conn.query(`
      SELECT COUNT(*) as parsed
      FROM ${tableName}
      WHERE "${columnName}" IS NOT NULL
        AND TRY_CAST("${columnName}" AS TIMESTAMP) IS NOT NULL
      LIMIT ${sampleSize}
    `)
    const parsed = parseResult.toArray()[0].parsed as number

    return parsed / total
  } catch {
    return 0
  } finally {
    await conn.close()
  }
}

/**
 * Create t_parsed view with auto-detected date columns
 * Adds *_date or *_ts suffix for successfully parsed columns
 */
export async function createParsedView(
  db: AsyncDuckDB,
  sourceTable = "t_raw",
  targetView = "t_parsed",
): Promise<string[]> {
  const conn = await db.connect()
  try {
    // Get schema
    const schemaResult = await conn.query(`PRAGMA table_info('${sourceTable}')`)
    const schema = schemaResult.toArray()

    const parsedColumns: string[] = []
    const selectClauses: string[] = []

    for (const col of schema) {
      const colName = col.name as string
      const colType = col.type as string

      // Always include original column
      selectClauses.push(`"${colName}"`)

      // Skip if already a date/timestamp type
      if (colType.includes("DATE") || colType.includes("TIMESTAMP")) {
        continue
      }

      // Check if it's a date candidate by name
      if (!isDateCandidate(colName)) {
        continue
      }

      // Test parsing success rate
      const successRate = await testDateParsing(db, sourceTable, colName)

      // If ≥80% parse successfully, add parsed column
      if (successRate >= 0.8) {
        const suffix = colName.toLowerCase().includes("time") ? "_ts" : "_date"
        const parsedName = `${colName}${suffix}`
        selectClauses.push(`TRY_CAST("${colName}" AS TIMESTAMP) as "${parsedName}"`)
        parsedColumns.push(parsedName)
      }
    }

    // Create view
    await conn.query(`
      CREATE OR REPLACE VIEW ${targetView} AS
      SELECT ${selectClauses.join(", ")}
      FROM ${sourceTable}
    `)

    return parsedColumns
  } finally {
    await conn.close()
  }
}
