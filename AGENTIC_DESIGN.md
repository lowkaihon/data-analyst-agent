# Agentic Architecture Design

## Overview

This document outlines the design for transforming the data analyst app into an agentic system where the AI can autonomously explore data, execute queries, create visualizations, and refine its analysis through iterative tool use.

## Current Architecture vs. Agentic Architecture

### Current (Non-Agentic)
```
User Question → Generate Plan → Execute Steps → Generate Report
                (single shot)    (client-side)   (single shot)
```

### Proposed (Agentic - Two-Stage)
```
Stage 1: Exploration (Agentic)
User Question → AI Agent Loop:
                  ├─ Analyze context
                  ├─ Execute SQL query (tool)
                  ├─ Examine results
                  ├─ Create visualization (tool)
                  ├─ Validate findings (tool)
                  ├─ Refine query if needed
                  └─ Return brief summary
                (stops when satisfied)
                  ↓
User Reviews Findings → [Generate Report Button]
                  ↓
Stage 2: Report Generation (User-Triggered)
Manual trigger → Use existing /api/report
               → Generate comprehensive markdown report
```

## Core Benefits

1. **Autonomous Exploration**: AI can iteratively refine queries based on results
2. **Self-Correction**: AI can detect errors and retry with different approaches
3. **Adaptive Analysis**: AI adjusts strategy based on what it discovers
4. **Quality Validation**: AI can verify its own findings before presenting
5. **Dynamic Visualization**: AI chooses appropriate charts based on data patterns

## Tool System Design

### Tool 1: SQL Execution Tool

**Purpose**: Execute SQL queries against the uploaded dataset

**Interface**:
```typescript
import { tool } from "ai"
import { z } from "zod"

export const sqlExecutorTool = tool({
  description: "Execute a read-only SQL query against the dataset table 't_parsed'",
  inputSchema: z.object({
    query: z.string().describe("DuckDB SQL query (SELECT only)"),
    reason: z.string().describe("Why this query is needed for the analysis")
  }),
  execute: async ({ query, reason }) => {
    // Execute using DuckDB
    // Return results with columns and rows
  }
})
```

**Note**: AI SDK v5 uses `inputSchema` (not `parameters`)

**Capabilities**:
- Execute SELECT queries only (read-only)
- Return structured results (columns + rows)
- Handle errors gracefully with helpful messages
- Apply row limits to prevent overwhelming responses
- Track query execution history

**Safety Features**:
- Query validation (no DROP, INSERT, UPDATE, DELETE)
- Timeout protection (max 30 seconds)
- Result size limits (max 1000 rows returned)
- Syntax validation before execution

### Tool 2: Visualization Tool ✅

**Purpose**: Create Vega-Lite chart specifications with client-side data execution

**Implementation Status**: ✅ Fully implemented with remote tool bridge pattern

**Interface**:
```typescript
{
  name: "createVisualization",
  description: "Create a data visualization chart to illustrate patterns, trends, or insights",
  inputSchema: z.object({
    chartType: z.enum(["bar", "line", "scatter", "area", "pie"]),
    sqlQuery: z.string().describe("SQL query to get data for the chart"),
    vegaLiteSpec: VegaLiteSpecSchema.describe("Vega-Lite specification (data will be injected)"),
    title: z.string().describe("Clear, descriptive title for the chart"),
    reason: z.string().describe("Brief explanation of what insight this visualization reveals")
  }),
  execute: async ({ chartType, sqlQuery, vegaLiteSpec, title, reason }, { toolCallId }) => {
    // Register pending call - client will execute SQL and generate chart
    const result = await registerPendingCall(toolCallId, "createVisualization", {
      chartType, sqlQuery, vegaLiteSpec, title, reason
    })
    return result
  }
}
```

**Architecture** (Remote Tool Bridge):
```
Server (AI):                        Client (Browser):
1. AI calls createVisualization
2. Register pending promise
3. Stream tool call to client   →   4. Detect tool call in message.parts
                                    5. Execute SQL in DuckDB-WASM
                                    6. Convert rows to Vega-Lite data format
                                    7. Inject data into vegaLiteSpec
                                    8. Store enriched spec for rendering
                                    9. POST result to /api/tool-callback
10. Resolve promise with result ←
11. AI continues with confirmation
```

**Client-Side Chart Generation**:
```typescript
// Detect visualization tool calls
if (part.type === "tool-createVisualization" && part.state === "input-available") {
  // Execute SQL in browser
  const result = await db.query(limitedSQL)

  // Convert to Vega-Lite format
  const chartData = rows.map((row) => {
    const dataPoint: Record<string, unknown> = {}
    columns.forEach((col, idx) => { dataPoint[col] = row[idx] })
    return dataPoint
  })

  // Inject data into spec
  const enrichedSpec = {
    ...vegaLiteSpec,
    data: { values: chartData },
    title: title
  }

  // Store for rendering
  setGeneratedCharts(prev => [...prev, { id: toolCallId, spec: enrichedSpec, title }])

  // Callback with success
  await fetch("/api/tool-callback", { ... })
}
```

**Chart Display**:
```typescript
import dynamic from "next/dynamic"
const VegaEmbed = dynamic(() => import("react-vega").then(mod => mod.VegaEmbed), { ssr: false })

{generatedCharts.map((chart) => (
  <Card key={chart.id}>
    <CardHeader>
      <CardTitle><BarChart3 /> {chart.title}</CardTitle>
    </CardHeader>
    <CardContent>
      <VegaEmbed spec={chart.spec} />
    </CardContent>
  </Card>
))}
```

**Capabilities**:
- ✅ Validate Vega-Lite specifications with Zod
- ✅ Execute SQL queries client-side in DuckDB-WASM
- ✅ Inject query results into chart specifications
- ✅ Apply consistent rendering with VegaEmbed (react-vega v8)
- ✅ Store charts with associated metadata
- ✅ Support multiple chart types (bar, line, scatter, area, pie)
- ✅ Privacy-preserving (data never leaves browser)
- ✅ Real-time chart generation during streaming

### Tool 3: Data Profiling Tool

**Purpose**: Get statistical summaries and data quality metrics

**Interface**:
```typescript
{
  name: "profileData",
  description: "Get statistical profile of dataset or specific columns",
  parameters: z.object({
    columns: z.array(z.string()).optional().describe("Specific columns to profile"),
    includeDistribution: z.boolean().default(false),
    includeNulls: z.boolean().default(true)
  }),
  execute: async ({ columns, includeDistribution, includeNulls }) => {
    // Generate SQL queries for profiling
    // Return stats: min, max, avg, median, mode, nulls, distinct values
  }
}
```

**Capabilities**:
- Calculate summary statistics
- Identify null/missing values
- Find outliers and anomalies
- Compute distribution metrics
- Detect data quality issues

### Tool 4: Analysis Validation Tool

**Purpose**: Validate analysis findings and check for common pitfalls

**Interface**:
```typescript
{
  name: "validateAnalysis",
  description: "Validate analysis findings for statistical significance and data quality",
  parameters: z.object({
    finding: z.string().describe("The insight or finding to validate"),
    relatedQuery: z.string().describe("SQL query that produced this finding")
  }),
  execute: async ({ finding, relatedQuery }) => {
    // Re-execute query with validation checks
    // Check sample size, outliers, missing data
    // Return validation report
  }
}
```

**Capabilities**:
- Check sample size adequacy
- Detect Simpson's paradox
- Identify correlation vs causation issues
- Flag suspicious patterns
- Verify statistical significance

## Remote Tool Bridge Architecture (Privacy-Preserving)

### The Challenge

**Problem**: DuckDB-WASM (client-side database) vs. Server-side tool execution
- User data is loaded in browser with DuckDB-WASM (for privacy)
- AI tool calling happens server-side (via Vercel AI SDK)
- Tool execution needs access to data → architectural conflict

**Naive Approach** (doesn't work):
```
❌ Server-side tool execution → No access to client-side DuckDB
❌ Send all data to server → Violates privacy requirement
❌ Client-side LLM → Expensive, slow, limited models
```

### The Solution: Remote Tool Bridge

**Architecture**: Split tool declaration from tool execution
1. **Server**: Declare tools for AI to use (tool calling happens here)
2. **Server**: Register pending promise when tool is invoked
3. **Stream**: Tool calls flow to client via UI message stream
4. **Client**: Detect tool calls, execute SQL in browser DuckDB
5. **Client**: POST results back to server via callback endpoint
6. **Server**: Resolve pending promise, AI continues with results

```
┌─────────────────────────────────────────────────────────┐
│                    SERVER SIDE                          │
│                                                          │
│  ┌──────────────────────────────────────────┐           │
│  │   AI Model (GPT-4o)                      │           │
│  │   - Decides to call executeSQLQuery      │           │
│  └──────────────┬───────────────────────────┘           │
│                 │                                        │
│                 ↓                                        │
│  ┌──────────────────────────────────────────┐           │
│  │   Bridge Tool (sql-executor-bridge.ts)   │           │
│  │   - registerPendingCall(toolCallId, args)│           │
│  │   - Returns Promise (waits for client)   │           │
│  └──────────────┬───────────────────────────┘           │
│                 │                                        │
│                 ↓ (promise suspended)                   │
│  ┌──────────────────────────────────────────┐           │
│  │   Tool Bridge (lib/tool-bridge.ts)       │           │
│  │   - pendingCalls Map (in globalThis)     │           │
│  │   - Stores: { toolCallId, resolve, reject }          │
│  └──────────────┬───────────────────────────┘           │
│                 │                                        │
│                 ↓                                        │
│  ┌──────────────────────────────────────────┐           │
│  │   Stream Response                        │           │
│  │   - toUIMessageStreamResponse()          │           │
│  │   - Tool call streamed to client         │           │
│  └──────────────┬───────────────────────────┘           │
│                 │                                        │
└─────────────────┼────────────────────────────────────────┘
                  │
                  │  Tool call in UI message stream
                  ↓
┌─────────────────────────────────────────────────────────┐
│                    CLIENT SIDE (Browser)                │
│                                                          │
│  ┌──────────────────────────────────────────┐           │
│  │   useChat Hook                           │           │
│  │   - Receives UI messages stream          │           │
│  └──────────────┬───────────────────────────┘           │
│                 │                                        │
│                 ↓                                        │
│  ┌──────────────────────────────────────────┐           │
│  │   AgenticExplorerBridge Component        │           │
│  │   - Detects tool calls in message.parts  │           │
│  │   - Filters for state === 'input-available'          │
│  └──────────────┬───────────────────────────┘           │
│                 │                                        │
│                 ↓                                        │
│  ┌──────────────────────────────────────────┐           │
│  │   SQL Execution (client-side)            │           │
│  │   1. validateSQL(query)                  │           │
│  │   2. conn = await db.connect()           │           │
│  │   3. result = await conn.query(sql)      │           │
│  │   4. Format: { columns, rows }           │           │
│  └──────────────┬───────────────────────────┘           │
│                 │                                        │
│                 ↓                                        │
│  ┌──────────────────────────────────────────┐           │
│  │   DuckDB-WASM Instance                   │           │
│  │   - In-memory database                   │           │
│  │   - Contains user's uploaded CSV data    │           │
│  │   - Data NEVER leaves browser            │           │
│  └──────────────┬───────────────────────────┘           │
│                 │                                        │
│                 ↓                                        │
│  ┌──────────────────────────────────────────┐           │
│  │   POST /api/tool-callback                │           │
│  │   Body: {                                │           │
│  │     toolCallId: "call_xyz",              │           │
│  │     success: true,                       │           │
│  │     result: { columns, rows }            │           │
│  │   }                                      │           │
│  └──────────────┬───────────────────────────┘           │
│                 │                                        │
└─────────────────┼────────────────────────────────────────┘
                  │
                  │  HTTP callback with results
                  ↓
┌─────────────────────────────────────────────────────────┐
│                    SERVER SIDE                          │
│                                                          │
│  ┌──────────────────────────────────────────┐           │
│  │   /api/tool-callback Endpoint            │           │
│  │   - Receives result from client          │           │
│  │   - Calls resolvePendingCall(toolCallId) │           │
│  └──────────────┬───────────────────────────┘           │
│                 │                                        │
│                 ↓                                        │
│  ┌──────────────────────────────────────────┐           │
│  │   Tool Bridge                            │           │
│  │   - Finds pending call in Map            │           │
│  │   - Calls resolve(result)                │           │
│  └──────────────┬───────────────────────────┘           │
│                 │                                        │
│                 ↓ (promise resolved!)                   │
│  ┌──────────────────────────────────────────┐           │
│  │   Bridge Tool                            │           │
│  │   - Returns result to AI                 │           │
│  └──────────────┬───────────────────────────┘           │
│                 │                                        │
│                 ↓                                        │
│  ┌──────────────────────────────────────────┐           │
│  │   AI Model                               │           │
│  │   - Continues reasoning with results     │           │
│  │   - May call more tools or finish        │           │
│  └──────────────────────────────────────────┘           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Tool Bridge (`lib/tool-bridge.ts`)
```typescript
// In-memory coordination with globalThis persistence
const globalForPendingCalls = globalThis as unknown as {
  pendingCalls: Map<string, PendingToolCall> | undefined
}

const pendingCalls =
  globalForPendingCalls.pendingCalls ?? new Map<string, PendingToolCall>()

globalForPendingCalls.pendingCalls = pendingCalls

export function registerPendingCall(toolCallId: string, toolName: string, args: any): Promise<any> {
  return new Promise((resolve, reject) => {
    pendingCalls.set(toolCallId, { toolCallId, toolName, args, resolve, reject, timestamp: Date.now() })

    // Timeout after 30s
    setTimeout(() => {
      const call = pendingCalls.get(toolCallId)
      if (call) {
        pendingCalls.delete(toolCallId)
        reject(new Error('Tool execution timeout after 30000ms'))
      }
    }, 30000)
  })
}

export function resolvePendingCall(toolCallId: string, result: any): boolean {
  const call = pendingCalls.get(toolCallId)
  if (!call) return false

  pendingCalls.delete(toolCallId)
  call.resolve(result)
  return true
}
```

**Why globalThis?** Next.js Fast Refresh reloads modules, clearing the Map. Using `globalThis` preserves pending calls across hot reloads.

#### 2. Bridge Tool (`lib/tools/sql-executor-bridge.ts`)
```typescript
export const sqlExecutorBridgeTool = tool({
  description: "Execute a read-only SQL query against the dataset table 't_parsed'",
  inputSchema: z.object({
    query: z.string().describe("DuckDB SQL query (SELECT only)"),
    reason: z.string().describe("Why this query is needed")
  }),

  execute: async ({ query, reason }, { toolCallId }) => {
    // Don't execute SQL - register pending call instead
    const result = await registerPendingCall(toolCallId, "executeSQLQuery", { query, reason })
    return result
  }
})
```

#### 3. Callback Endpoint (`app/api/tool-callback/route.ts`)
```typescript
export async function POST(req: NextRequest) {
  const { toolCallId, success, result, error } = await req.json()

  if (success && result) {
    resolvePendingCall(toolCallId, result)
    return NextResponse.json({ success: true })
  } else {
    rejectPendingCall(toolCallId, error || "Unknown error")
    return NextResponse.json({ success: true })
  }
}
```

#### 4. Client-Side Executor (`components/agentic-explorer-bridge.tsx`)
```typescript
useEffect(() => {
  if (!db) return

  const processToolCalls = async () => {
    for (const message of messages) {
      const parts = (message as any).parts || []

      for (const part of parts) {
        // Only process when input is fully available
        if (
          part.type === "tool-executeSQLQuery" &&
          part.toolCallId &&
          part.state === "input-available" &&
          !processedToolCalls.current.has(part.toolCallId)
        ) {
          processedToolCalls.current.add(part.toolCallId)
          const { query, reason } = part.input || {}

          try {
            // Validate and execute SQL in browser
            const sanitizedSQL = validateSQL(query)

            // Handle semicolons before adding LIMIT
            let limitedSQL = sanitizedSQL.trim().replace(/;+\s*$/, '')
            if (!limitedSQL.match(/LIMIT\s+\d+/i)) {
              limitedSQL = `${limitedSQL} LIMIT 1000`
            }

            const conn = await db.connect()
            const result = await conn.query(limitedSQL)
            await conn.close()

            // Send result back to server
            await fetch("/api/tool-callback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                toolCallId: part.toolCallId,
                success: true,
                result: {
                  success: true,
                  data: {
                    columns: result.schema.fields.map(f => f.name),
                    rows: result.toArray().map(row => Object.values(row))
                  }
                }
              })
            })
          } catch (error) {
            // Send error back to server
            await fetch("/api/tool-callback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                toolCallId: part.toolCallId,
                success: false,
                error: error instanceof Error ? error.message : String(error)
              })
            })
          }
        }
      }
    }
  }

  processToolCalls().catch(console.error)
}, [messages, db])
```

### Privacy & Security Benefits

1. **Data Never Leaves Browser**: All SQL execution happens client-side
2. **Results-Only Transmission**: Only query results (not raw data) sent to server
3. **Client-Side Validation**: SQL guardrails applied in browser before execution
4. **User Control**: Data stays local, user controls what's analyzed
5. **No Server Storage**: Server doesn't persist any data

### Bridge Pattern Trade-offs

**Advantages:**
- ✅ Complete data privacy
- ✅ Works with any browser-based database
- ✅ Server doesn't need database access
- ✅ Scales well (client does the work)

**Challenges:**
- ⚠️ More complex architecture
- ⚠️ Requires Fast Refresh handling (globalThis)
- ⚠️ Network latency for each callback
- ⚠️ Client must handle tool execution

## Agent Flow Design

### Phase 1: Context Understanding
```
AI receives: User question + dataset schema + sample data
AI decides: What type of analysis is needed?
```

### Phase 2: Exploratory Analysis
```
AI uses: executeSQLQuery tool (multiple times)
- Get overview statistics
- Identify key patterns
- Explore relationships
- Filter and segment data
```

### Phase 3: Deep Dive
```
AI uses: executeSQLQuery + createVisualization
- Focus on specific findings
- Create supporting visualizations
- Cross-validate insights
```

### Phase 4: Validation
```
AI uses: validateAnalysis tool
- Check findings for robustness
- Identify limitations
- Confirm statistical validity
```

### Phase 5: Summary (Not Full Report)
```
AI generates: Brief summary of findings
- 2-3 sentence summary of key discoveries
- List of insights found
- NO full report yet - waiting for user trigger
```

**Important**: The agentic exploration does NOT automatically generate a full report. It only provides a brief summary. The user must manually trigger report generation by clicking "Generate Report".

## Implementation Architecture

### Two-Stage Architecture

**Stage 1: Agentic Exploration** - `/api/agentic-explore`
- AI autonomously explores data using tools
- Stops when it has gathered enough insights
- Returns brief summary + findings (NOT full report)

**Stage 2: Report Generation** - `/api/report` (existing endpoint)
- User manually triggers after reviewing findings
- Takes exploration results as input
- Generates comprehensive markdown report

### New API Endpoints

**Primary Endpoint (with Bridge)**: `/api/agentic-explore-bridge`

```typescript
POST /api/agentic-explore-bridge
Request: {
  question: string
  schema: Array<{name: string, type: string}>
  sampleData: any[]
  rowCount: number
  dataDescription?: string
  maxSteps?: number // Default: 15
}

Response: {
  status: "exploration_complete" | "error"
  summary: string // Brief 2-3 sentence summary
  insights: string[] // Key findings discovered
  executedQueries: Array<{
    query: string
    reason: string
    result: {columns: string[], rows: any[]}
  }>
  charts: Array<{
    id: string
    chartType: string
    spec: object
    title: string
    sqlQuery: string
  }>
  metadata: {
    stepCount: number
    tokensUsed: number
    durationMs: number
  }
}
```

**Callback Endpoint (for Bridge)**: `/api/tool-callback`

```typescript
POST /api/tool-callback
Request: {
  toolCallId: string
  success: boolean
  result?: any  // If success === true
  error?: string  // If success === false
}

Response: {
  success: boolean
  message: string
}
```

**Purpose**: Receives execution results from client-side tool execution and resolves pending server-side tool calls.

### Updated `/api/report` Endpoint (Enhanced)

```typescript
POST /api/report
Request: {
  question: string
  schema: Array<{name: string, type: string}>

  // NEW: Accept exploration results
  explorationResults?: {
    summary: string
    insights: string[]
    executedQueries: Array<...>
    charts: Array<...>
  }

  // Legacy support (if called without exploration)
  sqlHistory?: Array<...>
  charts?: Array<...>
}

Response: {
  report: string // Comprehensive markdown report
}
```

### Tool Execution Layer

```
┌─────────────────────────────────────┐
│     AI Agent (generateText)         │
│  - Reasoning & decision making      │
│  - Tool selection                   │
│  - Result interpretation            │
└──────────────┬──────────────────────┘
               │
               ↓
┌──────────────────────────────────────┐
│         Tool Orchestrator            │
│  - Route tool calls                  │
│  - Handle errors                     │
│  - Enforce safety limits             │
└──────────┬───────────────────────────┘
           │
    ┌──────┴──────┬──────────┬─────────┐
    ↓             ↓          ↓         ↓
[SQL Tool]  [Chart Tool] [Profile] [Validate]
    │             │          │         │
    └─────────────┴──────────┴─────────┘
                  ↓
         ┌────────────────┐
         │  DuckDB Engine │
         └────────────────┘
```

### Data Flow (Two-Stage)

```
1. User uploads CSV
   ↓
2. Store in DuckDB (in-memory or file-based)
   ↓
3. User asks question
   ↓
4. POST /api/agentic-explore
   ↓
5. AI Agent Loop:
   - AI makes tool calls
   - Tools execute → Results returned
   - Repeats until stopWhen condition met
   ↓
6. Return exploration results (NO full report)
   ↓
7. Client displays:
   - Brief summary
   - Queries executed
   - Charts created
   - [Generate Report] button
   ↓
8. User reviews and clicks "Generate Report"
   ↓
9. POST /api/report with exploration results
   ↓
10. Generate comprehensive markdown report
   ↓
11. Display final report to user
```

## stopWhen Strategy

### Two-Stage stopWhen Strategy

#### Stage 1: Exploration (Agentic)

```typescript
import { streamText, stepCountIs } from "ai"

const result = streamText({
  model: openai("gpt-4o"),
  tools: {
    executeSQLQuery,
    createVisualization,
    profileData,
    validateAnalysis
  },
  stopWhen: stepCountIs(15), // AI SDK v5: Use stepCountIs() instead of maxSteps
  system: `Analyze the data to answer the question using available tools.

  When you have gathered enough insights, provide a BRIEF summary (2-3 sentences).
  DO NOT generate a full comprehensive report - that will be created later if the user requests it.

  Your final message should be a concise summary of key findings.`,
  prompt: question
})

// Stream response to client for real-time updates
return result.toTextStreamResponse()

// User must manually trigger report generation
```

#### Stage 2: Report Generation (User-Triggered)

```typescript
// Only called when user clicks "Generate Report" button
const report = streamText({
  model: openai("gpt-4o"),
  // NO tools - just text generation
  system: `Create a comprehensive markdown report based on the exploration results...`,
  prompt: `Generate report for: "${question}"\n\nExploration findings: ${explorationResults}`
})

return report.toTextStreamResponse()
// Full comprehensive markdown report
```

### Why This Two-Stage Strategy?

#### Benefits:
1. **User Control**: User decides when to generate expensive full report
2. **Cost Optimization**: Only generate report when actually needed
3. **Review Opportunity**: User can verify findings before committing to report
4. **Flexibility**: User can ask follow-up questions instead of generating report
5. **Clear Separation**: Exploration ≠ Report generation

#### stopWhen Behavior:
- **`stepCountIs(15)`**: Limits exploration to maximum 15 tool call steps
- AI naturally stops when it has enough information (often before reaching limit)
- **After stopWhen triggers**: Return brief summary, NOT full report
- **Note**: AI SDK v5 uses `stepCountIs()` - older versions used `maxSteps` or `noToolCallsInLastStep()`

### Typical Step Count by Analysis Type

- Simple queries: 3-5 steps → brief summary → user triggers report
- Exploratory analysis: 5-8 steps → brief summary → user triggers report
- Complex multi-faceted: 10-15 steps → brief summary → user triggers report

## State Management

### Agent Session State

```typescript
interface AgentSession {
  sessionId: string
  question: string
  datasetMetadata: {
    schema: Array<{name: string, type: string}>
    rowCount: number
    sampleData: any[]
  }
  executionHistory: {
    stepNumber: number
    toolName: string
    toolArgs: object
    toolResult: object
    timestamp: Date
  }[]
  generatedCharts: Array<{
    id: string
    spec: object
    sql: string
  }>
  status: "running" | "completed" | "error"
  startTime: Date
  endTime?: Date
}
```

### Persistence Strategy

- **In-memory**: For quick analyses (< 5 min)
- **Database**: For long-running analyses
- **Client updates**: Via Server-Sent Events (SSE) or WebSocket

## Error Handling & Recovery

### Tool Execution Errors

```typescript
{
  name: "executeSQLQuery",
  execute: async ({ query }) => {
    try {
      const result = await db.query(query)
      return { success: true, data: result }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        hint: suggestFix(error) // Help AI recover
      }
    }
  }
}
```

### Agent Guidance

When tools fail, return structured errors that help the AI:
- **Syntax errors**: Highlight the issue with DuckDB-specific guidance
- **No results**: Suggest alternative queries
- **Timeout**: Suggest adding filters or limits
- **Invalid columns**: List available columns

## Cost & Performance Considerations

### Token Usage

**Current Approach**:
- Plan generation: ~2K tokens
- Report generation: ~5K tokens
- Total: ~7K tokens per analysis

**Agentic Approach**:
- Context: ~3K tokens
- Per step: ~1K-2K tokens
- Average 8 steps: ~15K tokens per analysis
- **~2x token cost**

### Optimization Strategies

1. **Limit context in later steps**: Only include recent tool results
2. **Summarize query results**: Don't send all 1000 rows to AI
3. **Use cheaper models for validation**: GPT-4o-mini for profileData
4. **Cache common queries**: Reuse results within session
5. **Truncate long results**: Keep first/last N rows + summary stats

### Performance Targets

- **Latency**: 10-30 seconds for typical analysis
- **Cost**: $0.02-0.10 per analysis (at current GPT-4o pricing)
- **Success rate**: >90% complete successfully

## Security Considerations

### SQL Injection Prevention

```typescript
const ALLOWED_SQL_PATTERNS = /^SELECT/i
const FORBIDDEN_KEYWORDS = ['DROP', 'INSERT', 'UPDATE', 'DELETE', 'ALTER']

function validateQuery(query: string): boolean {
  if (!ALLOWED_SQL_PATTERNS.test(query)) return false
  if (FORBIDDEN_KEYWORDS.some(kw => query.toUpperCase().includes(kw))) {
    return false
  }
  return true
}
```

### Resource Limits

- **Query timeout**: 30 seconds max
- **Result size**: 1000 rows max
- **Step count**: 15 steps max
- **Session duration**: 5 minutes max
- **Concurrent sessions**: Rate limit per user

### Data Privacy

**With Remote Tool Bridge Architecture:**
- **Browser-side execution**: Data stays in browser with DuckDB-WASM
- **No raw data transmission**: Only query results sent to server (never raw rows)
- **Client-side validation**: SQL guardrails applied before execution
- **No server storage**: Server doesn't store or persist any user data
- **User control**: Data never leaves user's device

## Monitoring & Observability

### Key Metrics

- **Step count distribution**: How many steps per analysis type?
- **Tool usage**: Which tools are used most often?
- **Error rate**: Which tools fail most?
- **Token usage**: Actual vs. estimated
- **Completion rate**: % of analyses that complete successfully
- **User satisfaction**: Implicit (analysis accepted/rejected)

### Logging Strategy

```typescript
{
  sessionId: string
  timestamp: Date
  event: "step_start" | "tool_call" | "tool_result" | "completion" | "error"
  stepNumber: number
  toolName?: string
  tokenCount: number
  durationMs: number
  error?: string
}
```

## Migration Path

### Phase 1: Proof of Concept (Week 1-2)
- [ ] Implement basic SQL execution tool
- [ ] Create simple agentic endpoint with 2 tools
- [ ] Test with example questions
- [ ] Compare results to current approach

### Phase 2: Full Tool Suite (Week 3-4)
- [ ] Add visualization tool
- [ ] Add profiling tool
- [ ] Add validation tool
- [ ] Implement robust error handling

### Phase 3: Production Readiness (Week 5-6)
- [ ] Streaming responses for real-time feedback
- [ ] Comprehensive testing suite
- [ ] Performance optimization
- [ ] Cost analysis and limits
- [ ] Monitoring dashboard

### Phase 4: Gradual Rollout (Week 7-8)
- [ ] A/B test: agentic vs. current
- [ ] Collect user feedback
- [ ] Measure quality improvement
- [ ] Refine based on learnings
- [ ] Full migration or hybrid approach

## UI/UX Changes

### Current UI
```
[Question Input]
  ↓
[Loading...]
  ↓
[Analysis Steps] ← Pre-planned, static
```

### Agentic UI (Two-Stage)
```
[Question Input]
  ↓
[Real-time Agent Activity - Stage 1: Exploration]
  ├─ 💭 Thinking: "Analyzing dataset structure..."
  ├─ 🔧 Tool: executeSQLQuery("SELECT...")
  ├─ ✅ Found: 1,234 rows
  ├─ 💭 Thinking: "Creating trend visualization..."
  ├─ 🔧 Tool: createVisualization(...)
  └─ ✅ Exploration complete!
  ↓
[Exploration Results Preview]
  📊 Created 2 visualizations
  📝 Key Findings:
      • Sales peak in Q4 (35% higher than avg)
      • Electronics category growing 12% YoY

  [Generate Full Report] [Ask Follow-up] [Start Over]
  ↓ (user clicks "Generate Full Report")
[Stage 2: Report Generation - Loading...]
  ↓
[Comprehensive Markdown Report]
  # Analysis Report
  ## Executive Summary
  ...
```

**Benefits**:
- **User Control**: User decides when to generate report
- **Transparency**: See AI's exploration process
- **Progress indication**: Real-time updates during exploration
- **Educational**: Users learn analysis approach
- **Trust building**: See AI's work before committing
- **Cost awareness**: User knows when expensive operations happen

## Testing Strategy

### Unit Tests
- Individual tool execution
- Query validation
- Result formatting
- Error handling

### Integration Tests
- Full agentic loop with mock tools
- stopWhen conditions
- State management
- Session lifecycle

### End-to-End Tests
- Real questions with real data
- Compare agentic vs. non-agentic results
- Measure quality and cost
- Test edge cases (empty results, errors, timeouts)

### Quality Metrics
- **Correctness**: Are SQL queries valid?
- **Relevance**: Do insights answer the question?
- **Completeness**: Are all aspects covered?
- **Efficiency**: Unnecessary tool calls?
- **Cost**: Token usage reasonable?

## Open Questions & Decisions Needed

1. **Streaming vs. Batch**: Stream exploration steps or return final result?
2. **Model Selection**: GPT-4o for all or mix with GPT-4o-mini?
3. **Tool Granularity**: More specific tools or fewer general tools?
4. **Hybrid Approach**: Keep current system as fallback?
5. **User Control**: Let users set maxSteps or auto-determine?
6. **Caching Strategy**: Cache tool results across sessions?
7. **Visualization Library**: Stay with Vega-Lite or support others?
8. ~~**Report Generation**: Auto-generate or user-triggered?~~ ✅ **DECIDED: User-triggered (two-stage approach)**

## Success Criteria

### MVP Success (Phase 1-2)
- ✅ Agent can autonomously answer 3 types of questions
- ✅ Tool calls are appropriate and not redundant
- ✅ Results match or exceed current system quality
- ✅ Average completion in < 30 seconds

### Production Success (Phase 3-4)
- ✅ >90% completion rate
- ✅ Cost per analysis < $0.10
- ✅ User satisfaction score improvement
- ✅ Zero SQL injection vulnerabilities
- ✅ Comprehensive monitoring in place

## References & Further Reading

- [Vercel AI SDK - Tools](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Vercel AI SDK - generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text)
- [Agent Design Patterns](https://www.anthropic.com/research/building-effective-agents)
- [DuckDB SQL Reference](https://duckdb.org/docs/sql/introduction)
- [Vega-Lite Documentation](https://vega.github.io/vega-lite/)

---

**Next Steps**: Review this design with team, prioritize features, and begin Phase 1 implementation.
