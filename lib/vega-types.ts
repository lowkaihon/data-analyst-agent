import { z } from "zod"

/**
 * Type-safe Vega-Lite schema definitions
 * Based on Vega-Lite specification v5
 */

// Basic types
export const VegaFieldSchema = z.object({
  field: z.string().optional(),
  type: z.enum(["quantitative", "temporal", "ordinal", "nominal", "geojson"]).optional(),
  aggregate: z.enum(["count", "sum", "mean", "average", "median", "min", "max", "stdev", "variance"]).optional(),
  timeUnit: z.string().optional(),
  bin: z.union([z.boolean(), z.object({ maxbins: z.number().optional() })]).optional(),
  title: z.string().optional(),
  scale: z.object({
    domain: z.array(z.union([z.string(), z.number()])).optional(),
    range: z.array(z.union([z.string(), z.number()])).optional(),
    scheme: z.string().optional(),
    type: z.enum(["linear", "log", "pow", "sqrt", "symlog", "time", "utc", "ordinal", "band", "point"]).optional(),
  }).optional(),
  axis: z.union([
    z.boolean(),
    z.object({
      title: z.string().optional(),
      format: z.string().optional(),
      labelAngle: z.number().optional(),
      grid: z.boolean().optional(),
    })
  ]).optional(),
  legend: z.union([
    z.boolean(),
    z.object({
      title: z.string().optional(),
      orient: z.enum(["left", "right", "top", "bottom"]).optional(),
    })
  ]).optional(),
}).passthrough() // Allow additional properties for flexibility

// Mark types
export const VegaMarkTypeSchema = z.enum([
  "area",
  "bar",
  "circle",
  "line",
  "point",
  "rect",
  "rule",
  "square",
  "text",
  "tick",
  "geoshape",
  "boxplot",
  "errorband",
  "errorbar",
])

export const VegaMarkSchema = z.union([
  VegaMarkTypeSchema,
  z.object({
    type: VegaMarkTypeSchema,
    tooltip: z.union([z.boolean(), z.object({}).passthrough()]).optional(),
    color: z.string().optional(),
    opacity: z.number().optional(),
    size: z.number().optional(),
    filled: z.boolean().optional(),
    point: z.union([z.boolean(), z.object({}).passthrough()]).optional(),
    line: z.union([z.boolean(), z.object({}).passthrough()]).optional(),
    interpolate: z.string().optional(),
  }).passthrough()
])

// Encoding channels
export const VegaEncodingSchema = z.object({
  x: VegaFieldSchema.optional(),
  y: VegaFieldSchema.optional(),
  x2: VegaFieldSchema.optional(),
  y2: VegaFieldSchema.optional(),
  color: VegaFieldSchema.optional(),
  opacity: VegaFieldSchema.optional(),
  size: VegaFieldSchema.optional(),
  shape: VegaFieldSchema.optional(),
  text: VegaFieldSchema.optional(),
  tooltip: z.union([
    VegaFieldSchema,
    z.array(VegaFieldSchema),
    z.object({ content: z.enum(["data", "encoding"]) })
  ]).optional(),
  detail: VegaFieldSchema.optional(),
  order: VegaFieldSchema.optional(),
  facet: VegaFieldSchema.optional(),
  row: VegaFieldSchema.optional(),
  column: VegaFieldSchema.optional(),
}).passthrough() // Allow additional encoding channels

// Data specification
export const VegaDataSchema = z.union([
  // Inline data
  z.object({
    values: z.array(z.record(z.unknown())),
  }),
  // Named data
  z.object({
    name: z.string(),
  }),
  // URL data
  z.object({
    url: z.string(),
    format: z.object({
      type: z.enum(["json", "csv", "tsv", "dsv", "topojson"]).optional(),
    }).optional(),
  }),
]).passthrough()

// Transform specifications
export const VegaTransformSchema = z.array(
  z.object({
    filter: z.union([z.string(), z.object({}).passthrough()]).optional(),
    calculate: z.string().optional(),
    as: z.string().optional(),
    aggregate: z.array(z.object({}).passthrough()).optional(),
    groupby: z.array(z.string()).optional(),
  }).passthrough()
).optional()

// Layer specification for layered charts
export const VegaLayerSpecSchema = z.object({
  mark: VegaMarkSchema.optional(),
  encoding: VegaEncodingSchema.optional(),
  transform: VegaTransformSchema.optional(),
  data: VegaDataSchema.optional(),
}).passthrough()

// Main Vega-Lite specification
export const VegaLiteSpecSchema = z.object({
  $schema: z.string().optional(),
  description: z.string().optional(),
  title: z.union([z.string(), z.object({ text: z.string() }).passthrough()]).optional(),
  data: VegaDataSchema.optional(),
  mark: VegaMarkSchema.optional(),
  encoding: VegaEncodingSchema.optional(),
  layer: z.array(VegaLayerSpecSchema).optional(),
  transform: VegaTransformSchema.optional(),
  width: z.union([z.number(), z.literal("container")]).optional(),
  height: z.union([z.number(), z.literal("container")]).optional(),
  autosize: z.union([
    z.enum(["pad", "fit", "fit-x", "fit-y", "none"]),
    z.object({
      type: z.enum(["pad", "fit", "fit-x", "fit-y", "none"]).optional(),
      resize: z.boolean().optional(),
      contains: z.enum(["content", "padding"]).optional(),
    })
  ]).optional(),
  background: z.string().optional(),
  padding: z.union([z.number(), z.object({
    left: z.number().optional(),
    right: z.number().optional(),
    top: z.number().optional(),
    bottom: z.number().optional(),
  })]).optional(),
  config: z.object({}).passthrough().optional(),
  params: z.array(z.object({}).passthrough()).optional(),
  resolve: z.object({}).passthrough().optional(),
  // Composition specs
  hconcat: z.array(z.object({}).passthrough()).optional(),
  vconcat: z.array(z.object({}).passthrough()).optional(),
  concat: z.array(z.object({}).passthrough()).optional(),
  facet: z.union([VegaFieldSchema, z.object({}).passthrough()]).optional(),
  spec: z.object({}).passthrough().optional(),
}).passthrough() // Allow additional properties for future Vega-Lite features

// Export types
export type VegaField = z.infer<typeof VegaFieldSchema>
export type VegaMark = z.infer<typeof VegaMarkSchema>
export type VegaEncoding = z.infer<typeof VegaEncodingSchema>
export type VegaData = z.infer<typeof VegaDataSchema>
export type VegaLiteSpec = z.infer<typeof VegaLiteSpecSchema>
