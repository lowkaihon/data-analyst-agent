# Real-time Tool Call Streaming - Implementation Example

## Backend: `/app/api/agentic-explore/route.ts`

```typescript
import { streamText, noToolCallsInLastStep } from "ai"
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
    maxSteps: 15,
    stopWhen: noToolCallsInLastStep(),

    system: `You are a data analyst exploring data.

    Use tools to analyze the data. When done, provide a BRIEF summary (2-3 sentences).
    DO NOT generate a full report - the user will request that separately.`,

    prompt: question,

    // Optional: Get notified after each step
    onStepFinish: (step) => {
      console.log('Step finished:', {
        stepType: step.stepType, // 'initial' | 'continue' | 'tool-result'
        toolCalls: step.toolCalls,
        toolResults: step.toolResults,
        text: step.text,
        finishReason: step.finishReason
      })
    }
  })

  // Stream the response to the client
  return result.toDataStreamResponse()
}
```

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
  stopWhen: noToolCallsInLastStep(),
  // When AI stops calling tools, the stream ends naturally
  // Final text chunk is the brief summary
})

// Client receives:
// Step 1: Tool call → Tool result
// Step 2: Tool call → Tool result
// Step 3: Tool call → Tool result
// Step 4: Text (no tool calls) ← stopWhen triggers here
// Stream ends with brief summary
```

---

**Recommendation**: Use `streamText` from **Phase 1** (not Phase 3) to get real-time UI working early. It's easier to implement streaming from the start than to add it later.
