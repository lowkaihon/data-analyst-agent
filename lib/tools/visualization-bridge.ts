/**
 * Visualization Bridge Tool
 *
 * Allows AI to create visualizations during agentic exploration.
 * Uses remote tool bridge pattern - chart generation happens client-side with actual data.
 */

import { tool } from "ai"
import { z } from "zod"
import { registerPendingCall } from "@/lib/tool-bridge"

// Vega-Lite spec schema (simplified - allows any valid Vega-Lite)
const VegaLiteSpecSchema = z.object({
  mark: z.union([
    z.string(),
    z.object({
      type: z.string(),
    }).passthrough(),
  ]),
  encoding: z.record(z.any()).optional(),
  data: z.any().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  title: z.string().optional(),
}).passthrough()

export const visualizationBridgeTool = tool({
  description: `Create a data visualization chart to illustrate patterns, trends, or insights.
Use this tool when a visual representation would make findings clearer.

Supported chart types:
- bar: Compare categories or show distributions
- line: Display trends over time or continuous data
- scatter: Explore relationships between two variables
- area: Show cumulative or stacked values over time
- pie: Display proportions of a whole

The SQL query will be executed client-side and data injected into the chart.`,

  inputSchema: z.object({
    chartType: z
      .enum(["bar", "line", "scatter", "area", "pie"])
      .describe("Type of chart to create"),
    sqlQuery: z
      .string()
      .describe(
        "SQL query to get data for the chart. Must return columns that match the encoding fields.",
      ),
    vegaLiteSpec: VegaLiteSpecSchema.describe(
      "Vega-Lite specification defining the chart. Do not include 'data' field - it will be injected from SQL results.",
    ),
    title: z.string().describe("Clear, descriptive title for the chart"),
    reason: z
      .string()
      .describe("Brief explanation of what insight this visualization reveals"),
  }),

  execute: async ({ chartType, sqlQuery, vegaLiteSpec, title, reason }, { toolCallId }) => {
    console.log(`[Visualization Bridge] Tool called with ID: ${toolCallId}`)
    console.log(`[Visualization Bridge] Chart Type: ${chartType}`)
    console.log(`[Visualization Bridge] Title: ${title}`)
    console.log(`[Visualization Bridge] Reason: ${reason}`)

    try {
      // Register pending call - client will execute SQL and generate chart
      const result = await registerPendingCall(toolCallId, "createVisualization", {
        chartType,
        sqlQuery,
        vegaLiteSpec,
        title,
        reason,
      })

      console.log(`[Visualization Bridge] Chart generated successfully`)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Visualization Bridge] Error:`, errorMessage)

      return {
        success: false,
        error: errorMessage,
        hint: "Chart generation failed. Check SQL query and Vega-Lite specification.",
      }
    }
  },
})
