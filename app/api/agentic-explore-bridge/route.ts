import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { sqlExecutorBridgeTool } from "@/lib/tools/sql-executor-bridge"

const RequestSchema = z.object({
  messages: z.array(z.any()), // UI messages from useChat
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
    const { messages, schema, sample, rowCount, dataDescription, maxSteps } =
      RequestSchema.parse(body)

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 })
    }

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Messages array is required" }, { status: 400 })
    }

    // Convert UI messages to model messages
    const modelMessages = convertToModelMessages(messages)

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

    // Stream the agentic exploration with bridge tool
    const result = streamText({
      model: openai("gpt-4o"),
      tools: {
        executeSQLQuery: sqlExecutorBridgeTool, // Use bridge version
      },
      system: systemPrompt,
      messages: modelMessages,
      stopWhen: stepCountIs(maxSteps),

      onFinish: ({ text, toolCalls, usage }) => {
        console.log(`[Agentic Explore Bridge] Finished:`, {
          toolCalls: toolCalls?.length || 0,
          hasText: !!text,
          tokensUsed: usage?.totalTokens || 0,
        })
      },
    })

    // Note: Tool calls automatically appear in the stream
    // The client detects them and executes SQL locally
    // Tool execute function waits for callback via bridge

    // Return UI message stream response for useChat compatibility
    // The client will see tool calls in the stream and execute SQL locally
    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("[Agentic Explore Bridge] Error:", error)

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
