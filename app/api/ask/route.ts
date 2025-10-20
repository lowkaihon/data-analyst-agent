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
5. For visualizations, provide Vega-Lite specs with inline data from query results

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
