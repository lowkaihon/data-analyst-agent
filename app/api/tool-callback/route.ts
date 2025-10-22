import { NextRequest, NextResponse } from "next/server"
import { resolvePendingCall, rejectPendingCall } from "@/lib/tool-bridge"
import { z } from "zod"

const CallbackSchema = z.object({
  toolCallId: z.string(),
  success: z.boolean(),
  result: z.any().optional(),
  error: z.string().optional(),
})

/**
 * Tool Callback Endpoint
 *
 * Receives execution results from client-side tool execution
 * and resolves the pending server-side tool call.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { toolCallId, success, result, error } = CallbackSchema.parse(body)

    console.log(`[Tool Callback] Received callback for ${toolCallId}`, {
      success,
      hasResult: !!result,
      hasError: !!error,
    })

    if (success && result) {
      // Resolve the pending call with the result
      const resolved = resolvePendingCall(toolCallId, result)

      if (!resolved) {
        return NextResponse.json(
          {
            error: "Tool call not found or already resolved",
            toolCallId,
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message: "Tool result received",
      })
    } else {
      // Reject the pending call with the error
      const rejected = rejectPendingCall(toolCallId, error || "Unknown error")

      if (!rejected) {
        return NextResponse.json(
          {
            error: "Tool call not found or already resolved",
            toolCallId,
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message: "Tool error received",
      })
    }
  } catch (error) {
    console.error("[Tool Callback] Error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid callback payload",
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: "Failed to process tool callback",
      },
      { status: 500 }
    )
  }
}
