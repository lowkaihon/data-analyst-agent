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
    const systemPrompt = `You are a data analyst creating a comprehensive markdown report focused on delivering ACTIONABLE INSIGHTS.

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

Create a professional markdown report that delivers ACTIONABLE INSIGHTS:

CRITICAL - Actionable Insights Framework:
An actionable insight must be:
• Specific: Pinpoint distinct problems or opportunities, not vague observations
• Measurable: Include concrete metrics that can be tracked
• Relevant: Connect directly to business goals and decision-making
• Timely: Provide context about urgency and timing
• Achievable: Recommend realistic, implementable actions

Report Structure:
1. Executive Summary
   - One-sentence answer to the analysis question
   - 2-3 key actionable insights (what to do about the findings)

2. Key Findings
   - Present discoveries using ACTUAL DATA from SQL results
   - For each finding, explain WHAT happened and WHY it matters
   - Include specific numbers, percentages, trends, and comparisons
   - Identify patterns, anomalies, and correlations

3. Actionable Insights & Recommendations
   For each major finding, provide:
   - Clear insight statement (the "so what?")
   - Specific recommended action (what to do)
   - Expected impact (why this matters)
   - Implementation priority (high/medium/low based on impact)
   - Success metrics to track

4. Methodology
   - Briefly describe approach and queries used
   - Note any limitations or data quality considerations

IMPORTANT GUIDELINES:
- Use actual numbers, values, and patterns from the SQL results - be specific, not generic
- Focus on insights that bridge analysis to action
- Avoid stating obvious facts without interpretation
- Connect findings to business decisions
- Prioritize recommendations by potential impact
- Use clear, concise language that non-technical stakeholders can understand

Use proper markdown formatting with headers, lists, bold for emphasis, and tables where appropriate.`

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
