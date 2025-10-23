import { tool } from "ai"
import { z } from "zod"
import { registerPendingCall } from "@/lib/tool-bridge"
import type { ToolExecutionResult, QueryResult } from "./types"

/**
 * SQL Execution Tool (Bridge Mode)
 *
 * This tool doesn't execute SQL directly. Instead, it:
 * 1. Registers a pending call
 * 2. Waits for client-side execution
 * 3. Returns the result when callback arrives
 *
 * This preserves data privacy by keeping SQL execution in the browser
 * where DuckDB is initialized with user data.
 */
export const sqlExecutorBridgeTool = tool({
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

  execute: async ({ query, reason }, { toolCallId }) => {
    console.log(`[SQL Bridge] Tool called with ID: ${toolCallId}`)
    console.log(`[SQL Bridge] Query: ${query}`)
    console.log(`[SQL Bridge] Reason: ${reason}`)

    // Register pending call and wait for client execution
    // The client will POST the result to /api/tool-callback
    try {
      const result = await registerPendingCall(toolCallId, "executeSQLQuery", {
        query,
        reason,
      })

      console.log(
        `[SQL Bridge] Received result for ${toolCallId}:`,
        result.success ? "success" : "error",
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      console.error(`[SQL Bridge] Error for ${toolCallId}:`, errorMessage)

      // Return error in the expected format
      return {
        success: false,
        error: errorMessage,
        hint: "SQL execution failed or timed out. The client may not have executed the query.",
      }
    }
  },
})

/**
 * Helper to emit sql_ready event to client
 * (This is called by the streaming endpoint)
 */
export function createSQLReadyEvent(toolCallId: string, query: string, reason: string) {
  return {
    type: "sql_ready",
    toolCallId,
    query,
    reason,
  }
}
