// Shared types for tool implementations

export interface QueryResult {
  columns: string[]
  rows: any[][]
  rowCount: number
  executionTimeMs: number
}

export interface ToolExecutionResult<T = any> {
  success: boolean
  data?: T
  error?: string
  hint?: string
}

export interface SQLExecutionContext {
  query: string
  reason: string
  maxRows?: number
  timeoutMs?: number
}

export interface ChartSpec {
  id: string
  chartType: "bar" | "line" | "scatter" | "area" | "histogram" | "boxplot"
  spec: Record<string, any> // Vega-Lite spec
  sqlQuery: string
  title: string
}
