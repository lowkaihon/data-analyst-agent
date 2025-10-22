import { streamText, stepCountIs } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { sqlExecutorTool } from "@/lib/tools/sql-executor"

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
  maxSteps: z.number().default(10),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { question, schema, sample, rowCount, dataDescription, maxSteps } =
      RequestSchema.parse(body)

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 })
    }

    // Build system prompt with dataset context
    const systemPrompt = `You are a data analyst exploring data to answer questions.

**Dataset Information:**
Schema:
${schema.map((col) => `- ${col.name} (${col.type})`).join("\n")}

Total rows: ${rowCount.toLocaleString()}

${dataDescription ? `User's description: ${dataDescription}\n` : ""}

Sample data (first ${sample.rows.length} rows):
${JSON.stringify(sample, null, 2)}

**Your Task:**
Use the executeSQLQuery tool to explore and analyze the data to answer the user's question.

**Important Guidelines:**
1. Table name is always "t_parsed"
2. Only use SELECT, WITH, and PRAGMA queries (read-only)
3. Be strategic - use queries to explore patterns, not just dump data
4. Build insights progressively from your query results
5. When you have gathered sufficient insights, provide a BRIEF summary (2-3 sentences max)
6. DO NOT generate a comprehensive report - just summarize key findings
7. The user will decide whether to generate a full report separately

**Analysis Approach:**
- Start with overview queries to understand the data
- Then dive deeper into specific patterns you discover
- Focus on answering the user's question directly
- Validate your findings if they seem significant

When you're done exploring, provide a concise summary of what you found.`

    // Stream the agentic exploration
    const result = streamText({
      model: openai("gpt-4o"),
      tools: {
        executeSQLQuery: sqlExecutorTool,
      },
      system: systemPrompt,
      prompt: question,
      stopWhen: stepCountIs(maxSteps), // Use stepCountIs for multi-step tool execution

      // Optional: Track steps for logging/debugging
      onFinish: ({ text, toolCalls, usage }) => {
        console.log(`[Agentic Explore] Finished:`, {
          toolCalls: toolCalls?.length || 0,
          hasText: !!text,
          tokensUsed: usage?.totalTokens || 0,
        })
      },
    })

    // Return streaming response
    // Client will receive real-time updates as tools are called
    return result.toTextStreamResponse()
  } catch (error) {
    console.error("[Agentic Explore] Error:", error)

    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Invalid request parameters",
          details: error.errors,
        },
        { status: 400 },
      )
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to start exploration",
      },
      { status: 500 },
    )
  }
}
