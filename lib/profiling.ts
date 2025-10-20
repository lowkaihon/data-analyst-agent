import type { AsyncDuckDB } from "@duckdb/duckdb-wasm"

export interface ColumnProfile {
  name: string
  type: string
  count: number
  nullCount: number
  uniqueCount: number
  min?: string | number
  max?: string | number
  mean?: number
  topValues?: Array<{ value: string; count: number }>
}

export interface TableProfile {
  rowCount: number
  columnCount: number
  columns: ColumnProfile[]
}

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
 * Profile a table to get statistics for each column
 */
export async function profileTable(db: AsyncDuckDB, tableName: string): Promise<TableProfile> {
  const conn = await db.connect()
  try {
    // Get row count
    const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM ${tableName}`)
    const rowCount = Number(countResult.toArray()[0].cnt)

    // Get schema
    const schemaResult = await conn.query(`PRAGMA table_info('${tableName}')`)
    const schema = schemaResult.toArray()

    const columns: ColumnProfile[] = []

    for (const col of schema) {
      const colName = col.name as string
      const colType = col.type as string

      // Basic stats
      const statsResult = await conn.query(`
        SELECT 
          COUNT(*) as count,
          COUNT(DISTINCT "${colName}") as unique_count,
          SUM(CASE WHEN "${colName}" IS NULL THEN 1 ELSE 0 END) as null_count
        FROM ${tableName}
      `)
      const stats = statsResult.toArray()[0]

      const profile: ColumnProfile = {
        name: colName,
        type: colType,
        count: Number(stats.count),
        nullCount: Number(stats.null_count),
        uniqueCount: Number(stats.unique_count),
      }

      // Numeric stats
      if (
        colType.includes("INT") ||
        colType.includes("DOUBLE") ||
        colType.includes("DECIMAL") ||
        colType.includes("FLOAT")
      ) {
        const numStatsResult = await conn.query(`
          SELECT 
            MIN("${colName}") as min,
            MAX("${colName}") as max,
            AVG("${colName}") as mean
          FROM ${tableName}
        `)
        const numStats = numStatsResult.toArray()[0]
        profile.min = convertBigIntToNumber(numStats.min) as number
        profile.max = convertBigIntToNumber(numStats.max) as number
        profile.mean = convertBigIntToNumber(numStats.mean) as number
      }

      // Top values (for low cardinality columns)
      if (profile.uniqueCount <= 20) {
        const topResult = await conn.query(`
          SELECT "${colName}" as value, COUNT(*) as count
          FROM ${tableName}
          WHERE "${colName}" IS NOT NULL
          GROUP BY "${colName}"
          ORDER BY count DESC
          LIMIT 10
        `)
        profile.topValues = topResult.toArray().map((row: any) => ({
          value: String(row.value),
          count: Number(row.count),
        }))
      }

      columns.push(profile)
    }

    return {
      rowCount,
      columnCount: columns.length,
      columns,
    }
  } finally {
    await conn.close()
  }
}

/**
 * Get a small sample of rows for LLM context
 */
export async function getSample(
  db: AsyncDuckDB,
  tableName: string,
  maxRows = 5,
): Promise<{ columns: string[]; rows: unknown[][] }> {
  const conn = await db.connect()
  try {
    const result = await conn.query(`SELECT * FROM ${tableName} LIMIT ${maxRows}`)
    const columns = result.schema.fields.map((f) => f.name)
    const rows = result.toArray().map((row) => Object.values(row).map(convertBigIntToNumber))
    return { columns, rows }
  } finally {
    await conn.close()
  }
}
