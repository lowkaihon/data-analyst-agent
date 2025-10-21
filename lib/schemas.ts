import { z } from "zod"
import { VegaLiteSpecSchema } from "./vega-types"

/**
 * Zod schemas for type safety
 */

export const ColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
})

export const SchemaInfoSchema = z.object({
  columns: z.array(ColumnSchema),
  rowCount: z.number(),
})

export const PlanStepSchema = z.object({
  step: z.number(),
  description: z.string(),
  sql: z.string().optional(),
  chartSpec: VegaLiteSpecSchema.optional(),
})

export const PlanSchema = z.object({
  reasoning: z.string(),
  steps: z.array(PlanStepSchema),
})

export const SQLResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
  executionTimeMs: z.number().optional(),
})

// Re-export VegaLiteSpecSchema as ChartSpecSchema for backwards compatibility
export const ChartSpecSchema = VegaLiteSpecSchema

export type ColumnInfo = z.infer<typeof ColumnSchema>
export type SchemaInfo = z.infer<typeof SchemaInfoSchema>
export type PlanStep = z.infer<typeof PlanStepSchema>
export type Plan = z.infer<typeof PlanSchema>
export type SQLResult = z.infer<typeof SQLResultSchema>
export type ChartSpec = z.infer<typeof ChartSpecSchema>
