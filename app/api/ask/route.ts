import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { PlanSchema } from "@/lib/schemas"

const RequestSchema = z.object({
  question: z.string(),
  schema: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
    }),
  ),
  sample: z.object({
    columns: z.array(z.string()),
    rows: z.array(z.array(z.unknown())),
  }),
  rowCount: z.number(),
  dataDescription: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { question, schema, sample, rowCount, dataDescription } = RequestSchema.parse(body)

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 })
    }

    // Build system prompt with privacy-preserving context
    const systemPrompt = `You are a data analyst assistant. The user has uploaded a CSV file with the following schema:

${schema.map((col) => `- ${col.name} (${col.type})`).join("\n")}

Total rows: ${rowCount.toLocaleString()}

${dataDescription ? `\nUser's description of the data:\n${dataDescription}\n` : ""}

Here's a small sample (first ${sample.rows.length} rows):
${JSON.stringify(sample, null, 2)}

IMPORTANT RULES:
1. Only generate READ-ONLY SQL queries (SELECT, WITH, PRAGMA)
2. Use DuckDB SQL syntax
3. The table name is "t_parsed"
4. Keep queries efficient and add LIMIT clauses
5. NEVER add semicolons at the end of SQL queries - the system will add them automatically
6. For visualizations, provide Vega-Lite specs following these guidelines:
   - IMPORTANT: Do NOT include the "data" field in chart specs - the system will automatically inject actual SQL results
   - Use appropriate chart types (bar, line, area, scatter, etc.)
   - Apply a professional color scheme (use config.range.category for categorical colors)
   - Set proper width/height (width: 500-600, height: 300-400 for most charts)
   - Include clear axis labels and titles
   - Use proper formatting for numbers (format: ",.0f" for integers, ",.2f" for decimals)
   - Add tooltips for interactivity
   - Use padding and spacing for clean layouts
   - For bar charts: add padding between bars, sort by value when appropriate
   - For time series: use temporal encoding with proper formatting
   - Apply a consistent theme with:
     * config.axis.labelFontSize: 11
     * config.axis.titleFontSize: 13
     * config.legend.labelFontSize: 11
     * config.legend.titleFontSize: 12
   - The encoding fields MUST match the column names from your SQL query exactly

Example of a well-styled bar chart (NOTE: no data field):
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "width": 500,
  "height": 350,
  "mark": {"type": "bar", "cornerRadiusEnd": 4},
  "encoding": {
    "x": {"field": "category", "type": "nominal", "axis": {"labelAngle": 0, "labelFontSize": 11}},
    "y": {"field": "value", "type": "quantitative", "axis": {"format": ",.0f", "titleFontSize": 13}},
    "color": {"value": "#4c78a8"},
    "tooltip": [
      {"field": "category", "type": "nominal"},
      {"field": "value", "type": "quantitative", "format": ",.0f"}
    ]
  },
  "config": {
    "bar": {"discreteBandSize": 40}
  }
}

Create a step-by-step analysis plan to answer the user's question.`

    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: PlanSchema,
      system: systemPrompt,
      prompt: question,
    })

    return Response.json({ plan: result.object })
  } catch (error) {
    console.error("[v0] Error in /api/ask:", error)
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate analysis plan",
      },
      { status: 500 },
    )
  }
}
