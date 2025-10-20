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
${item.result ? `Results: ${item.result.rows.length} rows returned` : "No results"}
`,
  )
  .join("\n")}

${charts.length > 0 ? `${charts.length} visualization(s) were created.` : "No visualizations created."}

Create a professional markdown report that:
1. Summarizes the analysis question
2. Describes the methodology and queries used
3. Presents key findings with data-backed insights
4. Includes relevant statistics and patterns discovered
5. Provides actionable conclusions

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
