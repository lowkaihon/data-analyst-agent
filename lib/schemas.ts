import { z } from "zod"

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
  chartSpec: z.any().optional(),
})

export const PlanSchema = z.object({
  reasoning: z.string(),
  steps: z.array(PlanStepSchema),
})

export const SQLResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
})

export const ChartSpecSchema = z.object({
  $schema: z.string().optional(),
  data: z.any(),
  mark: z.any(),
  encoding: z.any().optional(),
  layer: z.any().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
})

export type ColumnInfo = z.infer<typeof ColumnSchema>
export type SchemaInfo = z.infer<typeof SchemaInfoSchema>
export type PlanStep = z.infer<typeof PlanStepSchema>
export type Plan = z.infer<typeof PlanSchema>
export type SQLResult = z.infer<typeof SQLResultSchema>
export type ChartSpec = z.infer<typeof ChartSpecSchema>
