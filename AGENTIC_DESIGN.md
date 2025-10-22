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

### Tool 2: Visualization Tool

**Purpose**: Create Vega-Lite chart specifications

**Interface**:
```typescript
{
  name: "createVisualization",
  description: "Create a Vega-Lite chart specification based on SQL query results",
  parameters: z.object({
    chartType: z.enum(["bar", "line", "scatter", "area", "histogram", "boxplot"]),
    spec: z.object({...}), // Vega-Lite spec
    sqlQuery: z.string().describe("SQL query that provides data for this chart"),
    title: z.string().describe("Chart title describing the insight")
  }),
  execute: async ({ chartType, spec, sqlQuery, title }) => {
    // Validate spec structure
    // Store chart for rendering
    // Return confirmation
  }
}
```

**Capabilities**:
- Validate Vega-Lite specifications
- Ensure fields match SQL column names
- Apply consistent styling/theming
- Store charts with associated SQL queries
- Support multiple chart types

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

### New API Endpoint: `/api/agentic-explore`

```typescript
POST /api/agentic-explore
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

- **In-memory processing**: Data never leaves server
- **No persistent storage**: Clear data after session
- **No external API calls**: All processing local

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
