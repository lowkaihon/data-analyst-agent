# Real-time Tool Call Streaming - Implementation Example

## Backend: `/app/api/agentic-explore/route.ts`

```typescript
import { streamText, stepCountIs } from "ai"
import { openai } from "@ai-sdk/openai"
import { sqlExecutorTool } from "@/lib/tools/sql-executor"
import { visualizationTool } from "@/lib/tools/visualization"

export async function POST(req: Request) {
  const { question, schema, sampleData, rowCount } = await req.json()

  const result = streamText({
    model: openai("gpt-4o"),
    tools: {
      executeSQLQuery: sqlExecutorTool,
      createVisualization: visualizationTool,
    },
    stopWhen: stepCountIs(15), // AI SDK v5: Use stepCountIs() instead of maxSteps

    system: `You are a data analyst exploring data.

    Use tools to analyze the data. When done, provide a BRIEF summary (2-3 sentences).
    DO NOT generate a full report - the user will request that separately.`,

    prompt: question,

    // Optional: Get notified when finished
    onFinish: ({ text, toolCalls, usage }) => {
      console.log('Exploration finished:', {
        toolCalls: toolCalls?.length || 0,
        hasText: !!text,
        tokensUsed: usage?.totalTokens || 0
      })
    }
  })

  // Stream the response to the client
  return result.toTextStreamResponse()
}
```

**Key API Changes in AI SDK v5**:
- ✅ Use `stepCountIs(n)` instead of `maxSteps`
- ✅ Use `toTextStreamResponse()` instead of `toDataStreamResponse()`
- ✅ Use `onFinish` callback instead of `onStepFinish`
- ✅ Tool definitions use `inputSchema` instead of `parameters`

## Frontend: React Component with `useChat`

### Option 1: Using Vercel AI SDK's `useChat` hook

```typescript
'use client'

import { useChat } from 'ai/react'
import { useState } from 'react'

export function AgenticExplorer() {
  const [explorationComplete, setExplorationComplete] = useState(false)

  const { messages, append, isLoading } = useChat({
    api: '/api/agentic-explore',

    // Real-time tool call updates!
    onToolCall: ({ toolCall }) => {
      console.log('Tool called:', toolCall.toolName, toolCall.args)
      // Update UI to show tool being executed
    },

    onFinish: (message) => {
      // Exploration complete
      setExplorationComplete(true)
    }
  })

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          {/* Show AI thinking */}
          {message.content && <div>{message.content}</div>}

          {/* Show tool calls in real-time */}
          {message.toolInvocations?.map((tool, idx) => (
            <ToolCallDisplay key={idx} tool={tool} />
          ))}
        </div>
      ))}

      {explorationComplete && (
        <button onClick={() => generateReport()}>
          Generate Full Report
        </button>
      )}
    </div>
  )
}

function ToolCallDisplay({ tool }) {
  return (
    <div className="tool-call">
      <div className="tool-icon">
        {tool.toolName === 'executeSQLQuery' && '🔧'}
        {tool.toolName === 'createVisualization' && '📊'}
      </div>

      <div className="tool-details">
        <div className="tool-name">{tool.toolName}</div>

        {/* Show args */}
        <div className="tool-args">
          {JSON.stringify(tool.args, null, 2)}
        </div>

        {/* Show result when available */}
        {tool.result && (
          <div className="tool-result">
            ✅ Completed: {JSON.stringify(tool.result, null, 2)}
          </div>
        )}

        {/* Show loading state */}
        {tool.state === 'call' && (
          <div className="tool-loading">⏳ Executing...</div>
        )}
      </div>
    </div>
  )
}
```

### Option 2: Manual Stream Handling (More Control)

```typescript
'use client'

import { useState } from 'react'

export function AgenticExplorer() {
  const [steps, setSteps] = useState<Step[]>([])
  const [isExploring, setIsExploring] = useState(false)

  async function startExploration(question: string) {
    setIsExploring(true)
    setSteps([])

    const response = await fetch('/api/agentic-explore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, schema, sampleData })
    })

    // Read the stream
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader!.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (line.startsWith('0:')) {
          // Text delta
          const text = JSON.parse(line.slice(2))
          // Update UI with text
        } else if (line.startsWith('9:')) {
          // Tool call
          const toolCall = JSON.parse(line.slice(2))
          setSteps(prev => [...prev, {
            type: 'tool_call',
            toolName: toolCall.toolName,
            args: toolCall.args,
            status: 'executing'
          }])
        } else if (line.startsWith('a:')) {
          // Tool result
          const toolResult = JSON.parse(line.slice(2))
          setSteps(prev => prev.map((step, idx) =>
            idx === prev.length - 1
              ? { ...step, result: toolResult, status: 'complete' }
              : step
          ))
        }
      }
    }

    setIsExploring(false)
  }

  return (
    <div>
      {steps.map((step, idx) => (
        <div key={idx} className="step">
          {step.type === 'tool_call' && (
            <>
              <div className="tool-header">
                🔧 {step.toolName}
                {step.status === 'executing' && '⏳'}
                {step.status === 'complete' && '✅'}
              </div>
              <pre>{JSON.stringify(step.args, null, 2)}</pre>
              {step.result && (
                <pre>{JSON.stringify(step.result, null, 2)}</pre>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}
```

## Key Stream Events

When using `streamText`, the response stream includes:

```typescript
// Data stream format (from Vercel AI SDK)
{
  // Text chunks (AI thinking/reasoning)
  "0": "Analyzing the dataset..."

  // Tool calls
  "9": {
    "toolCallId": "call_123",
    "toolName": "executeSQLQuery",
    "args": {
      "query": "SELECT * FROM t_parsed LIMIT 10",
      "reason": "Get initial data overview"
    }
  }

  // Tool results
  "a": {
    "toolCallId": "call_123",
    "result": {
      "columns": ["date", "sales"],
      "rows": [[...]]
    }
  }

  // Finish event
  "d": {
    "finishReason": "stop"
  }
}
```

## UI States to Handle

1. **Thinking**: AI is reasoning (show text stream)
2. **Tool Call**: AI decided to use a tool (show which tool + args)
3. **Tool Executing**: Tool is running (show spinner)

---

## 🎉 Phase 2 Progress: Visualization Tool Implementation

### ✅ Completed: Visualization Tool with Remote Bridge Pattern

**Implementation Date**: 2025-10-23

**What Was Built**:
1. **Server-Side Bridge Tool** (`lib/tools/visualization-bridge.ts`)
   - Accepts Vega-Lite specifications from AI
   - Uses remote tool bridge pattern for privacy-preserving execution
   - Validates input with Zod schemas

2. **Client-Side Chart Generation** (`components/agentic-explorer-bridge.tsx`)
   - Detects visualization tool calls in message stream
   - Executes SQL queries in browser DuckDB-WASM
   - Converts query results to Vega-Lite data format
   - Injects data into chart specifications
   - Renders charts with VegaEmbed (react-vega v8)

3. **API Integration** (`app/api/agentic-explore-bridge/route.ts`)
   - Added createVisualization tool to streaming endpoint
   - Enhanced system prompt with visualization guidance
   - Tool calls stream in real-time to client

**Key Technical Details**:

**VegaEmbed Dynamic Import** (avoiding SSR issues):
```typescript
import dynamic from "next/dynamic"
const VegaEmbed = dynamic(
  () => import("react-vega").then(mod => mod.VegaEmbed),
  { ssr: false }
)
```

**Client-Side Tool Call Detection**:
```typescript
useEffect(() => {
  const processToolCalls = async () => {
    for (const message of messages) {
      for (const part of (message as any).parts || []) {
        if (
          part.type === "tool-createVisualization" &&
          part.state === "input-available" &&
          !processedToolCalls.current.has(part.toolCallId)
        ) {
          // Execute SQL in browser DuckDB
          const result = await db.query(limitedSQL)

          // Convert to Vega-Lite data
          const chartData = rows.map((row) => {
            const dataPoint: Record<string, unknown> = {}
            columns.forEach((col, idx) => { dataPoint[col] = row[idx] })
            return dataPoint
          })

          // Inject and render
          const enrichedSpec = { ...vegaLiteSpec, data: { values: chartData }, title }
          setGeneratedCharts(prev => [...prev, { id: toolCallId, spec: enrichedSpec, title }])

          // Send callback
          await fetch("/api/tool-callback", { ... })
        }
      }
    }
  }
  processToolCalls().catch(console.error)
}, [messages, db])
```

**Chart Display**:
```typescript
{generatedCharts.map((chart) => (
  <Card key={chart.id}>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-sm font-medium">
        <BarChart3 className="h-4 w-4 text-purple-600" />
        {chart.title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="w-full overflow-x-auto">
        <VegaEmbed spec={chart.spec} />
      </div>
    </CardContent>
  </Card>
))}
```

**Bugs Fixed During Implementation**:
1. ✅ **Missing Closing Brace** - Added missing `}` for `processToolCalls` async function
2. ✅ **VegaLite Import Error** - react-vega v8 exports `VegaEmbed`, not `VegaLite`
3. ✅ **Dynamic Import Syntax** - Corrected Next.js dynamic import for VegaEmbed

**Dependencies Added**:
- `react-vega@8.0.0` - React component wrapper for Vega-Lite
- `vega` - Core Vega library (peer dependency)
- `vega-embed` - Vega-Lite embedding library (peer dependency)

**Testing Status**:
- ✅ Syntax errors resolved
- ✅ TypeScript compilation passes
- ✅ Dev server runs successfully
- ⏳ Pending: End-to-end testing with actual chart generation

**Next Steps**:
1. Test visualization tool with sample data
2. Verify AI can create different chart types (bar, line, scatter, area, pie)
3. Ensure charts display correctly in UI
4. Proceed to Step 2.2: Data Profiling Tool

---
4. **Tool Result**: Tool completed (show result preview)
5. **Complete**: No more tools, exploration done (show summary + CTA)

## Example UI Component Structure

```tsx
<div className="exploration-stream">
  {/* Real-time steps */}
  {steps.map((step, idx) => (
    <div key={idx} className="step">
      {step.type === 'thinking' && (
        <div className="thinking">
          💭 {step.text}
        </div>
      )}

      {step.type === 'tool_call' && (
        <div className="tool-call">
          <div className="tool-header">
            <ToolIcon name={step.toolName} />
            <span>{step.toolName}</span>
            <StepStatus status={step.status} />
          </div>

          {step.toolName === 'executeSQLQuery' && (
            <SqlQueryDisplay query={step.args.query} />
          )}

          {step.toolName === 'createVisualization' && (
            <ChartPreview spec={step.args.spec} />
          )}

          {step.result && (
            <ResultPreview result={step.result} />
          )}
        </div>
      )}
    </div>
  ))}

  {/* Final summary when complete */}
  {explorationComplete && (
    <div className="exploration-complete">
      <h3>✅ Exploration Complete</h3>
      <p>{summary}</p>

      <div className="stats">
        📊 {chartCount} visualizations created
        📈 {queryCount} queries executed
      </div>

      <button onClick={generateReport}>
        Generate Full Report
      </button>
    </div>
  )}
</div>
```

## Benefits of Streaming

1. **Transparency**: User sees exactly what AI is doing
2. **Progress indication**: No black box waiting
3. **Educational**: Users learn analysis techniques
4. **Trust building**: See the work being done
5. **Engagement**: Much more interesting than loading spinner
6. **Early feedback**: User can stop if AI goes wrong direction

## Performance Considerations

- Stream updates are very lightweight (incremental data)
- No need to wait for entire analysis to complete
- User gets value immediately
- Can show partial results while exploration continues

## stopWhen with Streaming

```typescript
const result = streamText({
  tools: { ... },
  stopWhen: stepCountIs(10), // AI SDK v5 API
  // After 10 tool call steps, the stream ends
  // Final text chunk is the brief summary
})

// Client receives:
// Step 1: Tool call → Tool result
// Step 2: Tool call → Tool result
// Step 3: Tool call → Tool result
// ...
// Step N: Text (AI decides it's done or reaches limit)
// Stream ends with brief summary
```

**Important**: AI SDK v5 changed the API:
- Old: `maxSteps: 10` or `stopWhen: noToolCallsInLastStep()`
- New: `stopWhen: stepCountIs(10)`

---

## Remote Tool Bridge Pattern (Privacy-Preserving Execution)

### The Problem

Standard server-side tool execution doesn't work when data is client-side:
- User data loaded in browser with DuckDB-WASM (privacy requirement)
- AI tool calling happens server-side (Vercel AI SDK)
- Tool execution needs access to data → architectural conflict

### The Solution: Bridge Pattern

**Server-side**: Declare tools and register pending promises
**Client-side**: Execute tools and post results back
**Server-side**: Resolve promises, AI continues

### Backend: Bridge Tool (`lib/tools/sql-executor-bridge.ts`)

```typescript
import { tool } from "ai"
import { z } from "zod"
import { registerPendingCall } from "@/lib/tool-bridge"

export const sqlExecutorBridgeTool = tool({
  description: `Execute a read-only SQL query against the dataset table 't_parsed'`,

  inputSchema: z.object({
    query: z.string().describe("DuckDB SQL query (SELECT only)"),
    reason: z.string().describe("Why this query is needed for analysis"),
  }),

  execute: async ({ query, reason }, { toolCallId }) => {
    console.log(`[SQL Bridge] Tool called with ID: ${toolCallId}`)

    // Don't execute SQL - register pending call instead
    // This promise will resolve when client sends result back
    try {
      const result = await registerPendingCall(toolCallId, "executeSQLQuery", {
        query,
        reason,
      })

      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        hint: "SQL execution failed or timed out. The client may not have executed the query.",
      }
    }
  },
})
```

### Backend: Tool Bridge Coordinator (`lib/tool-bridge.ts`)

```typescript
export interface PendingToolCall {
  toolCallId: string
  toolName: string
  args: any
  resolve: (result: any) => void
  reject: (error: Error) => void
  timestamp: number
}

// Use globalThis to survive Next.js Fast Refresh
const globalForPendingCalls = globalThis as unknown as {
  pendingCalls: Map<string, PendingToolCall> | undefined
}

const pendingCalls =
  globalForPendingCalls.pendingCalls ?? new Map<string, PendingToolCall>()

globalForPendingCalls.pendingCalls = pendingCalls

const TOOL_TIMEOUT_MS = 30000

export function registerPendingCall(
  toolCallId: string,
  toolName: string,
  args: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    pendingCalls.set(toolCallId, {
      toolCallId,
      toolName,
      args,
      resolve,
      reject,
      timestamp: Date.now(),
    })

    setTimeout(() => {
      const call = pendingCalls.get(toolCallId)
      if (call) {
        pendingCalls.delete(toolCallId)
        reject(new Error(`Tool execution timeout after ${TOOL_TIMEOUT_MS}ms`))
      }
    }, TOOL_TIMEOUT_MS)
  })
}

export function resolvePendingCall(toolCallId: string, result: any): boolean {
  const call = pendingCalls.get(toolCallId)
  if (!call) return false

  pendingCalls.delete(toolCallId)
  call.resolve(result)
  return true
}

export function rejectPendingCall(toolCallId: string, error: string): boolean {
  const call = pendingCalls.get(toolCallId)
  if (!call) return false

  pendingCalls.delete(toolCallId)
  call.reject(new Error(error))
  return true
}
```

### Backend: Callback Endpoint (`app/api/tool-callback/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server"
import { resolvePendingCall, rejectPendingCall } from "@/lib/tool-bridge"
import { z } from "zod"

const CallbackSchema = z.object({
  toolCallId: z.string(),
  success: z.boolean(),
  result: z.any().optional(),
  error: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { toolCallId, success, result, error } = CallbackSchema.parse(body)

    if (success && result) {
      const resolved = resolvePendingCall(toolCallId, result)

      if (!resolved) {
        return NextResponse.json(
          { error: "Tool call not found or already resolved" },
          { status: 404 }
        )
      }

      return NextResponse.json({ success: true })
    } else {
      const rejected = rejectPendingCall(toolCallId, error || "Unknown error")

      if (!rejected) {
        return NextResponse.json(
          { error: "Tool call not found or already resolved" },
          { status: 404 }
        )
      }

      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error("[Tool Callback] Error:", error)
    return NextResponse.json(
      { error: "Failed to process tool callback" },
      { status: 500 }
    )
  }
}
```

### Backend: Streaming Endpoint (`app/api/agentic-explore-bridge/route.ts`)

```typescript
import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { openai } from "@ai-sdk/openai"
import { sqlExecutorBridgeTool } from "@/lib/tools/sql-executor-bridge"

export async function POST(req: Request) {
  const body = await req.json()
  const { messages, schema, sample, rowCount } = body

  const modelMessages = convertToModelMessages(messages)

  const result = streamText({
    model: openai("gpt-4o"),
    tools: {
      executeSQLQuery: sqlExecutorBridgeTool, // Use bridge version
    },
    system: `You are a data analyst exploring data...

Use the executeSQLQuery tool to explore and analyze the data.
When you have gathered sufficient insights, provide a BRIEF summary (2-3 sentences max).`,
    messages: modelMessages,
    stopWhen: stepCountIs(10),

    onFinish: ({ text, toolCalls, usage }) => {
      console.log('Exploration finished:', {
        toolCalls: toolCalls?.length || 0,
        tokensUsed: usage?.totalTokens || 0
      })
    }
  })

  // Tool calls automatically appear in the stream
  // The client detects them and executes SQL locally
  // Tool execute function waits for callback via bridge
  return result.toUIMessageStreamResponse()
}
```

### Frontend: Client-Side Executor (`components/agentic-explorer-bridge.tsx`)

```typescript
'use client'

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useState, useEffect, useRef } from "react"
import { validateSQL } from "@/lib/sql-guards"
import type { AsyncDuckDB } from "@duckdb/duckdb-wasm"

export function AgenticExplorerBridge({
  question,
  schema,
  sample,
  rowCount,
  db, // DuckDB instance passed from parent
}) {
  const [hasStarted, setHasStarted] = useState(false)
  const processedToolCalls = useRef(new Set<string>())

  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/agentic-explore-bridge",
      body: { schema, sample, rowCount },
    }),
  })

  // Start exploration on mount
  useEffect(() => {
    if (!hasStarted) {
      setHasStarted(true)
      sendMessage({ text: question })
    }
  }, [])

  // Execute SQL locally when tool calls appear
  useEffect(() => {
    if (!db) return

    const processToolCalls = async () => {
      for (const message of messages) {
        const parts = (message as any).parts || []

        for (const part of parts) {
          // Check if this is a SQL tool call that needs execution
          // ONLY process when input is fully available (not streaming)
          if (
            part.type === "tool-executeSQLQuery" &&
            part.toolCallId &&
            part.state === "input-available" &&
            !processedToolCalls.current.has(part.toolCallId)
          ) {
            // Mark as processed to prevent duplicates
            processedToolCalls.current.add(part.toolCallId)

            const { query, reason } = part.input || {}

            console.log(`[SQL Bridge Client] Executing SQL for ${part.toolCallId}`)

            if (!query || typeof query !== "string" || !query.trim()) {
              console.error("[SQL Bridge Client] Invalid query")

              await fetch("/api/tool-callback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  toolCallId: part.toolCallId,
                  success: false,
                  error: "No query provided in tool call",
                }),
              })

              continue
            }

            try {
              // Validate SQL first (throws on invalid)
              const sanitizedSQL = validateSQL(query)

              // Remove trailing semicolon and add LIMIT if needed
              let limitedSQL = sanitizedSQL.trim().replace(/;+\s*$/, '')

              if (!limitedSQL.match(/LIMIT\s+\d+/i)) {
                limitedSQL = `${limitedSQL} LIMIT 1000`
              }

              // Execute SQL in browser DuckDB
              const conn = await db.connect()
              const startTime = performance.now()

              try {
                const result = await conn.query(limitedSQL)
                const executionTimeMs = performance.now() - startTime

                const columns = result.schema.fields.map((f) => f.name)
                const rows = result.toArray().map((row) => Object.values(row))

                console.log(`[SQL Bridge Client] Success: ${rows.length} rows in ${executionTimeMs}ms`)

                // Send result callback
                await fetch("/api/tool-callback", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    toolCallId: part.toolCallId,
                    success: true,
                    result: {
                      success: true,
                      data: {
                        columns,
                        rows,
                        rowCount: rows.length,
                        executionTimeMs: Math.round(executionTimeMs),
                      },
                    },
                  }),
                })
              } finally {
                await conn.close()
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)

              console.error(`[SQL Bridge Client] Error:`, errorMessage)

              // Send error callback
              await fetch("/api/tool-callback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  toolCallId: part.toolCallId,
                  success: false,
                  error: errorMessage,
                }),
              })
            }
          }
        }
      }
    }

    processToolCalls().catch((error) => {
      console.error("[SQL Bridge Client] Error processing tool calls:", error)
    })
  }, [messages, db])

  return (
    <div className="exploration-stream">
      {/* Render messages and tool calls */}
      {messages.map((message) => (
        <div key={message.id}>
          {/* Display tool execution and results */}
        </div>
      ))}
    </div>
  )
}
```

### Key Implementation Details

**1. State Detection**: Only process tool calls when `state === "input-available"`
- `input-streaming`: Input args are still being received (not ready yet)
- `input-available`: Input args are complete (ready to execute)
- `output-available`: Tool has completed (already processed)

**2. Deduplication**: Use Set to track processed toolCallIds
```typescript
const processedToolCalls = useRef(new Set<string>())

if (!processedToolCalls.current.has(part.toolCallId)) {
  processedToolCalls.current.add(part.toolCallId)
  // Execute tool
}
```

**3. SQL Semicolon Handling**: Strip trailing semicolons before adding LIMIT
```typescript
// AI might generate: "SELECT * FROM t_parsed;"
let limitedSQL = sanitizedSQL.trim().replace(/;+\s*$/, '')

if (!limitedSQL.match(/LIMIT\s+\d+/i)) {
  limitedSQL = `${limitedSQL} LIMIT 1000`
}
// Result: "SELECT * FROM t_parsed LIMIT 1000"
```

**4. globalThis for Fast Refresh**: Preserve Map across hot reloads
```typescript
const globalForPendingCalls = globalThis as unknown as {
  pendingCalls: Map<string, PendingToolCall> | undefined
}

const pendingCalls =
  globalForPendingCalls.pendingCalls ?? new Map<string, PendingToolCall>()

globalForPendingCalls.pendingCalls = pendingCalls
```

Without `globalThis`, Next.js Fast Refresh would clear the Map, causing 404s on callbacks.

**5. Map-based UI Updates**: Use Map instead of Set for reactive updates
```typescript
// Before (doesn't update when state changes):
const seenIds = new Set<string>()
if (!seenIds.has(id)) {
  seenIds.add(id)
  flowItems.push(item)
}

// After (updates when state changes):
const flowItemsMap = new Map<string, FlowItem>()
flowItemsMap.set(id, item) // Updates existing or adds new

const flowItems = Array.from(flowItemsMap.values())
```

This ensures tool cards update from "Executing..." to "Complete" ✅

### Privacy Benefits

1. **Data Never Leaves Browser**: All SQL execution happens client-side
2. **Results-Only Transmission**: Only query results sent to server (never raw rows)
3. **Client-Side Validation**: SQL guardrails applied before execution
4. **No Server Storage**: Server doesn't persist user data
5. **User Control**: Data stays local on user's device

### Testing the Bridge

**Test Page**: `/test-bridge`
- Initializes DuckDB with sample data
- Demonstrates full bridge flow
- Shows real-time tool execution
- Verifies results flow back correctly

---

**Recommendation**: Use `streamText` from **Phase 1** (not Phase 3) to get real-time UI working early. It's easier to implement streaming from the start than to add it later.

**For Privacy-Preserving Analysis**: Use the Remote Tool Bridge pattern to keep data in the browser while leveraging server-side AI tool calling.
