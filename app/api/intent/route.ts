import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"

const IntentRequestSchema = z.object({
  message: z.string(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
  dataContext: z
    .object({
      schemaColumns: z.array(z.string()).optional(),
      dataDescription: z.string().optional(),
    })
    .optional(),
})

const IntentResponseSchema = z.object({
  intent: z.enum(["chat", "analysis"]),
  reasoning: z.string().describe("Brief explanation for the classification decision"),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { message, conversationHistory, dataContext } = IntentRequestSchema.parse(body)

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 })
    }

    // Build context for intent classification
    const historyContext =
      conversationHistory && conversationHistory.length > 0
        ? `\n\nRecent conversation:\n${conversationHistory
            .slice(-4)
            .map((msg) => `${msg.role}: ${msg.content}`)
            .join("\n")}`
        : ""

    const dataContextInfo = dataContext?.dataDescription
      ? `\n\nData context: ${dataContext.dataDescription}`
      : dataContext?.schemaColumns
        ? `\n\nAvailable data columns: ${dataContext.schemaColumns.slice(0, 10).join(", ")}`
        : ""

    const systemPrompt = `You are an intent classifier for a data analysis assistant.

Your task is to classify the user's message into one of two intents:

1. "chat" - Use this for:
   - Greetings (hi, hello, hey, good morning)
   - Thanks/acknowledgments (thanks, thank you, appreciated)
   - Clarifications or confirmations (ok, got it, I see)
   - Meta-questions about the conversation itself (how many questions have I asked?, what did we analyze?)
   - General conversation not related to data analysis
   - Requests for help or explanations about the tool itself

2. "analysis" - Use this for:
   - Requests to analyze data (show me, what is, how many, find)
   - Requests for visualizations (chart, graph, plot, visualize)
   - Questions about patterns, trends, or insights in the data
   - Comparisons or aggregations (compare, average, total, distribution)
   - Follow-up questions referring to previous analysis (break that down, show more detail, what about)
   - Any query that requires SQL execution or data exploration

Guidelines:
- When in doubt, prefer "analysis" (better to over-analyze than miss a request)
- Consider conversation history for context (e.g., "show more" after analysis is "analysis")
- Mixed messages like "thanks! now show me revenue" should be classified as "analysis"
- Questions about the conversation ("what did we discuss?") are "chat"
- Questions about the data ("what data do we have?", "what columns?") are "chat" if general, "analysis" if specific

Examples:
- "hi" → chat
- "hello there" → chat
- "thanks!" → chat
- "how many questions have I asked?" → chat (meta-question about conversation)
- "what did we analyze so far?" → chat (meta-question)
- "show me top customers" → analysis
- "what's the average revenue?" → analysis
- "can you break that down by region?" → analysis (follow-up)
- "visualize this as a pie chart" → analysis
- "thanks! now show sales trends" → analysis (contains analysis request)
- "what columns do we have?" → chat (general question about data structure)
- "what's in the revenue column?" → analysis (specific data exploration)${historyContext}${dataContextInfo}

Classify this message and provide brief reasoning.`

    const result = await generateObject({
      model: openai("gpt-4o-mini"), // Fast and cost-effective for classification
      schema: IntentResponseSchema,
      system: systemPrompt,
      prompt: `User message: "${message}"`,
      temperature: 0.3, // Lower temperature for consistent classification
    })

    return Response.json(result.object)
  } catch (error) {
    console.error("[intent] Error classifying intent:", error)

    // Fallback: default to "analysis" to be safe (better to over-analyze than miss requests)
    return Response.json({
      intent: "analysis",
      reasoning: "Error during classification, defaulting to analysis for safety",
    })
  }
}
