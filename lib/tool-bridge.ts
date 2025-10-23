/**
 * Remote Tool Bridge
 *
 * Coordinates server-side tool calls with client-side execution.
 * Maintains data privacy by executing SQL in the browser where DuckDB is initialized.
 */

export interface PendingToolCall {
  toolCallId: string
  toolName: string
  args: any
  resolve: (result: any) => void
  reject: (error: Error) => void
  timestamp: number
}

// In-memory storage for pending tool calls
// Uses globalThis to persist across Next.js Fast Refresh in development
// In production, use Redis or similar for multi-instance support
const globalForPendingCalls = globalThis as unknown as {
  pendingCalls: Map<string, PendingToolCall> | undefined
}

const pendingCalls =
  globalForPendingCalls.pendingCalls ?? new Map<string, PendingToolCall>()

globalForPendingCalls.pendingCalls = pendingCalls

// Timeout for tool execution (30 seconds)
const TOOL_TIMEOUT_MS = 30000

/**
 * Register a pending tool call that needs client execution
 */
export function registerPendingCall(
  toolCallId: string,
  toolName: string,
  args: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    // Store the pending call
    pendingCalls.set(toolCallId, {
      toolCallId,
      toolName,
      args,
      resolve,
      reject,
      timestamp: Date.now(),
    })

    // Set timeout
    setTimeout(() => {
      const call = pendingCalls.get(toolCallId)
      if (call) {
        pendingCalls.delete(toolCallId)
        reject(new Error(`Tool execution timeout after ${TOOL_TIMEOUT_MS}ms`))
      }
    }, TOOL_TIMEOUT_MS)
  })
}

/**
 * Resolve a pending tool call with results from client
 */
export function resolvePendingCall(toolCallId: string, result: any): boolean {
  const call = pendingCalls.get(toolCallId)

  if (!call) {
    return false
  }

  pendingCalls.delete(toolCallId)
  call.resolve(result)
  return true
}

/**
 * Reject a pending tool call with an error from client
 */
export function rejectPendingCall(toolCallId: string, error: string): boolean {
  const call = pendingCalls.get(toolCallId)

  if (!call) {
    return false
  }

  pendingCalls.delete(toolCallId)
  call.reject(new Error(error))
  return true
}

/**
 * Get info about a pending call (for debugging)
 */
export function getPendingCall(toolCallId: string): PendingToolCall | undefined {
  return pendingCalls.get(toolCallId)
}

/**
 * Clean up old pending calls (called periodically)
 */
export function cleanupExpiredCalls(): number {
  const now = Date.now()
  let cleaned = 0

  for (const [id, call] of pendingCalls.entries()) {
    if (now - call.timestamp > TOOL_TIMEOUT_MS) {
      pendingCalls.delete(id)
      call.reject(new Error('Tool execution expired'))
      cleaned++
    }
  }

  return cleaned
}
