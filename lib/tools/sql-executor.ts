import { tool } from "ai"
import { z } from "zod"
import { getDuckDBInstance } from "@/lib/services/duckdb-manager"
import type { ToolExecutionResult, QueryResult } from "./types"

/**
 * SQL Execution Tool
 *
 * Allows the AI agent to execute read-only SQL queries against the dataset.
 * Features:
 * - Query validation (SELECT only)
 * - Timeout protection (30 seconds)
 * - Result size limits (1000 rows max)
 * - Helpful error messages for recovery
 */
export const sqlExecutorTool = tool({
  description: `Execute a read-only SQL query against the dataset table 't_parsed'.

  Use this tool to:
  - Explore data structure and contents
  - Calculate aggregations and statistics
  - Filter and sort data
  - Group and analyze patterns

  The table name is always 't_parsed'.
  Only SELECT, WITH, and PRAGMA queries are allowed.
  Results are limited to 1000 rows.`,

  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "DuckDB SQL query to execute. Must be a SELECT query. Table name is 't_parsed'. Example: SELECT * FROM t_parsed LIMIT 10",
      ),
    reason: z
      .string()
      .describe(
        "Brief explanation of why this query is needed for the analysis (helps with debugging and logging)",
      ),
  }),

  execute: async ({ query, reason }) => {
    const db = getDuckDBInstance()

    try {
      console.log(`[SQL Tool] Executing query: ${reason}`)
      console.log(`[SQL Tool] Query: ${query}`)

      // Execute query with built-in validation
      const result = await db.executeQuery(query)

      console.log(
        `[SQL Tool] Success: ${result.rowCount} rows in ${result.executionTimeMs}ms`,
      )

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      console.error(`[SQL Tool] Error:`, errorMessage)

      // Provide helpful hints for recovery
      let hint: string | undefined

      if (errorMessage.includes("Forbidden keyword")) {
        hint =
          "Only read-only queries (SELECT, WITH, PRAGMA) are allowed. Try rewriting without modification keywords."
      } else if (errorMessage.includes("timeout")) {
        hint = "Query took too long. Try adding filters (WHERE clause) or LIMIT to reduce data processed."
      } else if (errorMessage.toLowerCase().includes("not found")) {
        hint =
          "Table or column not found. Remember: table name is 't_parsed'. Check column names in the schema."
      } else if (errorMessage.toLowerCase().includes("syntax error")) {
        hint =
          "SQL syntax error. Make sure you're using DuckDB-compatible SQL. For custom ordering, use CASE WHEN instead of FIELD()."
      }

      return {
        success: false,
        error: errorMessage,
        hint,
      }
    }
  },
})
