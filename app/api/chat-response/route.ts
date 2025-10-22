import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import type { ColumnInfo, Plan } from "@/lib/schemas"

const MessageContextSchema = z.object({
  messageType: z.enum(["greeting", "plan_intro", "completion", "rejection"]),
  context: z.object({
    // For greeting
    fileName: z.string().optional(),
    rowCount: z.number().optional(),
    schema: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(),
        }),
      )
      .optional(),
    dataDescription: z.string().optional(),

    // For plan_intro
    userQuestion: z.string().optional(),
    plan: z
      .object({
        reasoning: z.string(),
        steps: z.array(
          z.object({
            step: z.number(),
            description: z.string(),
            sql: z.string().optional(),
          }),
        ),
      })
      .optional(),

    // For completion
    executedSteps: z.array(z.string()).optional(),
    chartTypes: z.array(z.string()).optional(),
    originalQuestion: z.string().optional(),

    // For rejection
    rejectedPlan: z
      .object({
        reasoning: z.string(),
        steps: z.array(z.any()),
      })
      .optional(),
  }),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messageType, context, conversationHistory } = MessageContextSchema.parse(body)

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 })
    }

    // Build system prompt based on message type
    let systemPrompt = ""
    let userPrompt = ""

    switch (messageType) {
      case "greeting": {
        systemPrompt = `You are a friendly, professional data analyst assistant. The user has just uploaded a CSV file.

Your task:
1. Welcome them naturally and conversationally (1-2 sentences)
2. If they provided a data description, acknowledge it and show you understand their data context
3. Mention 1-2 interesting aspects of their data (schema, size, column types)
4. Suggest what they might explore or ask about (be specific based on column names)

Be warm, professional, and helpful. Keep it concise (2-3 sentences max).`

        const schemaInfo =
          context.schema
            ?.map((col) => `${col.name} (${col.type})`)
            .slice(0, 10)
            .join(", ") || "columns"

        userPrompt = `File uploaded: "${context.fileName}"
Rows: ${context.rowCount?.toLocaleString() || "unknown"}
Columns (${context.schema?.length || 0}): ${schemaInfo}${context.dataDescription ? `\n\nUser's description: "${context.dataDescription}"` : ""}

Generate a welcoming message.`
        break
      }

      case "plan_intro": {
        systemPrompt = `You are a data analyst assistant explaining your analysis approach.

Your task:
1. Explain in 1-2 sentences what analysis you'll perform to answer the user's question
2. Be specific about the insights you'll uncover (mention key metrics, visualizations, or patterns)
3. Sound natural and conversational, not robotic
4. Build excitement about the insights they'll discover

Keep it brief and engaging (2 sentences max). Don't say "I've created a plan" - just explain what you'll do.`

        const stepsSummary = context.plan?.steps.map((s) => `Step ${s.step}: ${s.description}`).join("\n") || ""

        userPrompt = `User asked: "${context.userQuestion}"

Analysis plan:
${context.plan?.reasoning || ""}

Steps:
${stepsSummary}

Generate a natural introduction explaining this analysis.`
        break
      }

      case "completion": {
        systemPrompt = `You are a data analyst assistant wrapping up an analysis.

Your task:
1. Celebrate completion with a brief, positive statement (1 sentence)
2. Suggest 2-3 specific, actionable follow-up questions the user might want to explore next
3. Make suggestions relevant to the analysis just performed and the original question
4. Be conversational and helpful, not generic

Format your response as:
- Opening statement about completion
- "You might want to:" followed by 2-3 bullet points with specific suggestions

Keep it concise and actionable.`

        const stepsList = context.executedSteps?.map((step, i) => `${i + 1}. ${step}`).join("\n") || "analysis steps"
        const chartsInfo =
          context.chartTypes && context.chartTypes.length > 0
            ? `\nVisualizations created: ${context.chartTypes.join(", ")}`
            : ""

        userPrompt = `Original question: "${context.originalQuestion}"

Executed steps:
${stepsList}${chartsInfo}

Generate a completion message with relevant follow-up suggestions.`
        break
      }

      case "rejection": {
        systemPrompt = `You are a supportive data analyst assistant. The user rejected your analysis plan.

Your task:
1. Acknowledge the rejection positively (1 sentence)
2. Encourage them to rephrase their question or provide more details
3. Optionally suggest what additional context might help
4. Be supportive and helpful, not defensive

Keep it brief and encouraging (2 sentences max).`

        userPrompt = `The user rejected this plan:
${context.rejectedPlan?.reasoning || "analysis plan"}

Generate a supportive response encouraging them to try again.`
        break
      }
    }

    // Generate AI response
    const result = await generateText({
      model: openai("gpt-4o-mini"), // Using mini for speed and cost-effectiveness
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7, // Slightly creative but still focused
      maxTokens: 300, // Keep responses concise
    })

    return Response.json({ message: result.text })
  } catch (error) {
    console.error("[chat-response] Error generating message:", error)
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate chat response",
      },
      { status: 500 },
    )
  }
}
