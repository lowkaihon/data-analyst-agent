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
- When appropriate, gently guide users toward analyzing their data
- Remember context from the conversation history

Guidelines:
- For greetings: Welcome them and mention you're ready to help with data analysis
- For thanks: Acknowledge warmly and offer to continue helping
- For meta-questions: Answer accurately based on conversation history
- For clarifications: Respond helpfully and guide next steps
- Keep responses brief (1-3 sentences typically)
- Don't generate analysis plans or SQL - this is just conversation

Examples:
- "hi" → "Hello! I'm ready to help you analyze your data. What would you like to explore?"
- "thanks" → "You're welcome! Let me know if you'd like to dive deeper into your data."
- "how many questions have I asked?" → "You've asked [count] questions so far. Feel free to continue exploring!"${dataContextDesc}

Respond naturally to the user's message while maintaining context from the conversation.`

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
      maxTokens: 200, // Keep responses concise
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
