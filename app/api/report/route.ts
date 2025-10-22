import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"

const RequestSchema = z.object({
  question: z.string(),
  schema: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
    }),
  ),
  sqlHistory: z.array(
    z.object({
      sql: z.string(),
      result: z
        .object({
          columns: z.array(z.string()),
          rows: z.array(z.array(z.unknown())),
        })
        .optional(),
    }),
  ),
  charts: z.array(z.any()),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { question, schema, sqlHistory, charts } = RequestSchema.parse(body)

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 })
    }

    // Build context for report generation
    const systemPrompt = `You are a data analyst creating a comprehensive markdown report.

Dataset Schema:
${schema.map((col) => `- ${col.name} (${col.type})`).join("\n")}

Analysis performed:
${sqlHistory
  .map(
    (item, idx) => `
Query ${idx + 1}:
\`\`\`sql
${item.sql}
\`\`\`
${
  item.result
    ? `
Results (${item.result.rows.length} rows):
Columns: ${item.result.columns.join(", ")}

Data (showing first ${Math.min(50, item.result.rows.length)} rows):
${JSON.stringify(
  item.result.rows.slice(0, 50).map((row) => {
    const obj: Record<string, unknown> = {}
    item.result!.columns.forEach((col, idx) => {
      obj[col] = row[idx]
    })
    return obj
  }),
  null,
  2,
)}
${item.result.rows.length > 50 ? `\n(${item.result.rows.length - 50} more rows not shown)` : ""}
`
    : "No results"
}
`,
  )
  .join("\n")}

${charts.length > 0 ? `${charts.length} visualization(s) were created.` : "No visualizations created."}

Create a professional markdown report that:
1. Summarizes the analysis question
2. Describes the methodology and queries used
3. Presents key findings with data-backed insights using the ACTUAL DATA from the SQL results above
4. Includes relevant statistics and patterns discovered from the data
5. Provides actionable conclusions based on the findings

IMPORTANT: Use the actual numbers, values, and patterns from the SQL results shown above. Don't be generic - reference specific data points, trends, and insights from the results.

Use proper markdown formatting with headers, lists, and emphasis.`

    const result = await generateText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      prompt: `Generate a comprehensive analysis report for the question: "${question}"`,
    })

    return Response.json({ report: result.text })
  } catch (error) {
    console.error("[v0] Error in /api/report:", error)
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate report",
      },
      { status: 500 },
    )
  }
}
