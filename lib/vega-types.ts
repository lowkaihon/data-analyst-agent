import { z } from "zod"
import type { TopLevelSpec } from "vega-lite"

/**
 * Type-safe Vega-Lite schema definitions
 * Uses simplified Zod schema for API validation while maintaining proper TypeScript types
 */

// Simplified Zod schema that accepts any valid Vega-Lite JSON
// This avoids build issues with complex nested schemas
export const VegaLiteSpecSchema = z.record(z.any())

// Use the proper Vega-Lite TypeScript type for type safety
export type VegaLiteSpec = TopLevelSpec
