import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"

const ChatRequestSchema = z.object({
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
      fileName: z.string().optional(),
      rowCount: z.number().optional(),
      columnCount: z.number().optional(),
      schemaColumns: z.array(z.string()).optional(),
      dataDescription: z.string().optional(),
    })
    .optional(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { message, conversationHistory, dataContext } = ChatRequestSchema.parse(body)

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 })
    }

    // Build data context description
    let dataContextDesc = ""
    if (dataContext) {
      const parts = []
      if (dataContext.fileName) {
        parts.push(`File: ${dataContext.fileName}`)
      }
      if (dataContext.rowCount) {
        parts.push(`${dataContext.rowCount.toLocaleString()} rows`)
      }
      if (dataContext.columnCount) {
        parts.push(`${dataContext.columnCount} columns`)
      }
      if (dataContext.schemaColumns && dataContext.schemaColumns.length > 0) {
        parts.push(`Columns: ${dataContext.schemaColumns.slice(0, 8).join(", ")}${dataContext.schemaColumns.length > 8 ? "..." : ""}`)
      }
      if (dataContext.dataDescription) {
        parts.push(`Description: ${dataContext.dataDescription}`)
      }

      if (parts.length > 0) {
        dataContextDesc = `\n\nCurrent dataset:\n${parts.join("\n")}`
      }
    }

    // Build conversation history for context
    const messages =
      conversationHistory && conversationHistory.length > 0
        ? conversationHistory.slice(-6).map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }))
        : []

    const systemPrompt = `You are a friendly, helpful data analyst assistant having a conversation with the user.

Your role:
- Respond naturally to greetings, thanks, and casual conversation
- Answer meta-questions about the conversation (e.g., "how many questions have I asked?")
- Be concise but warm and professional
- Proactively suggest valuable analyses based on the dataset
- Guide users toward discovering actionable insights
- Remember context from the conversation history

Guidelines:
- For greetings: Welcome them warmly, and if they have data loaded, suggest 1-2 specific analyses they could start with based on the column names
- For thanks: Acknowledge warmly and suggest a logical next analysis step
- For meta-questions: Answer accurately based on conversation history
- For clarifications: Respond helpfully and guide next steps
- When data is loaded, proactively suggest analyses that could yield actionable insights
- Keep responses brief (2-3 sentences typically)
- Don't generate analysis plans or SQL - this is just conversation

Suggestion Strategy (when data is loaded):
Look at the column names and data description to suggest analyses such as:
- Trends over time (if date/time columns exist)
- Distribution analysis (for numerical data)
- Category comparisons (for categorical data)
- Correlations between key metrics
- Outlier or anomaly detection
- Segmentation analysis
- Performance benchmarking

Examples:
- "hi" (with sales data) → "Hello! I see you have sales data with dates and categories. Would you like to explore trends over time or compare performance across categories?"
- "thanks" (after completing an analysis) → "You're welcome! Based on what we found, you might want to analyze [specific suggestion] next to get deeper insights."
- "what should I analyze?" → "Great question! Looking at your data, I'd suggest: 1) [specific analysis], 2) [specific analysis]. Which interests you?"${dataContextDesc}

Respond naturally to the user's message while maintaining context from the conversation. When data is available, be proactive in suggesting valuable analyses.`

    const result = await generateText({
      model: openai("gpt-4o-mini"), // Fast and cost-effective
      system: systemPrompt,
      messages: [
        ...messages,
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.7, // Natural, conversational tone
    })

    return Response.json({ message: result.text })
  } catch (error) {
    console.error("[chat] Error generating chat response:", error)
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate chat response",
      },
      { status: 500 },
    )
  }
}
