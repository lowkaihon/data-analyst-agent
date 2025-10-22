# Agentic Architecture - Implementation Roadmap

## Quick Start Guide

This roadmap breaks down the implementation into concrete, actionable steps with estimated time and clear deliverables.

## Phase 1: Proof of Concept with Streaming (4-6 days)

**Goal**: Build a streaming agentic exploration endpoint with SQL execution tool to validate the two-stage approach.

**Important**:
- This phase implements Stage 1 (Agentic Exploration) with **real-time streaming**
- Report generation (Stage 2) uses the existing `/api/report` endpoint
- Streaming is included from the start for real-time tool call visualization

### Step 1.1: Set up tool infrastructure (2-3 hours)

**Files to create**:
- `lib/tools/sql-executor.ts` - SQL execution tool
- `lib/tools/types.ts` - Shared types for tools
- `lib/services/duckdb-manager.ts` - DuckDB connection management

**Tasks**:
- [x] Install required dependencies: `pnpm add duckdb` (already installed)
- [x] Create tool type definitions
- [x] Implement SQL query validation (read-only checks)
- [x] Set up DuckDB connection pooling
- [x] Add query timeout protection

### Step 1.2: Create SQL execution tool (2-3 hours)

**Implementation**:
```typescript
// lib/tools/sql-executor.ts
import { tool } from "ai"
import { z } from "zod"

export const sqlExecutorTool = tool({
  description: "Execute a read-only SQL query against the dataset",
  parameters: z.object({
    query: z.string(),
    reason: z.string()
  }),
  execute: async ({ query, reason }) => {
    // 1. Validate query (SELECT only)
    // 2. Execute with timeout
    // 3. Format results
    // 4. Return with metadata
  }
})
```

**Tasks**:
- [x] Implement query validation logic
- [x] Add DuckDB query execution
- [x] Format results (columns + rows)
- [x] Handle errors gracefully
- [x] Add logging

### Step 1.3: Create streaming agentic exploration endpoint (4-5 hours) ✅

**Files to create**:
- `app/api/agentic-explore/route.ts` - Streaming agentic exploration endpoint (Stage 1)

**Implementation** (Two-Stage Approach with Streaming):
```typescript
import { streamText, stepCountIs } from "ai"
import { openai } from "@ai-sdk/openai"
import { sqlExecutorTool } from "@/lib/tools/sql-executor"

export async function POST(req: Request) {
  const { question, schema, sampleData, rowCount } = await req.json()

  const result = streamText({
    model: openai("gpt-4o"),
    tools: {
      executeSQLQuery: sqlExecutorTool
    },
    stopWhen: stepCountIs(10), // AI SDK v5: Use stepCountIs() instead of maxSteps
    system: `You are a data analyst exploring data to answer questions.

    Use the executeSQLQuery tool to analyze the data.
    When you have gathered enough insights, provide a BRIEF summary (2-3 sentences).

    DO NOT generate a full comprehensive report - that will be created later if the user requests it.
    Your final message should be a concise summary of key findings.`,
    prompt: question,

    // Optional: Track when finished (for logging)
    onFinish: ({ text, toolCalls, usage }) => {
      console.log('Exploration finished:', {
        toolCalls: toolCalls?.length || 0,
        hasText: !!text,
        tokensUsed: usage?.totalTokens || 0
      })
    }
  })

  // Stream the response to the client
  // Client will receive real-time updates as tools are called
  return result.toTextStreamResponse()
}
```

**Why streamText from Phase 1?**
- ✅ Real-time tool call visualization (user requirement)
- ✅ Better UX from the start
- ✅ Not significantly harder than generateText
- ✅ Easier to implement streaming early than add later
- ✅ Users see progress, not just loading spinner

**AI SDK v5 API Notes**:
- Use `stepCountIs(n)` not `maxSteps`
- Use `toTextStreamResponse()` not `toDataStreamResponse()`
- Tool definitions use `inputSchema` not `parameters`

**Tasks**:
- [x] Create streaming endpoint structure for Stage 1
- [x] Use `streamText` instead of `generateText`
- [x] Integrate SQL tool
- [x] Set up stopWhen conditions with `stepCountIs()`
- [x] Configure system prompt to return brief summary (NOT full report)
- [x] Return `toUIMessageStreamResponse()` for useChat compatibility
- [x] Add error handling for streams
- [x] Use `convertToModelMessages()` to handle UI messages from useChat
- [x] Test with example questions and verify real-time updates ✅

### Step 1.4: Create basic streaming UI (3-4 hours) ✅

**Files to create/modify**:
- `components/agentic-explorer.tsx` - New component for streaming exploration

**Implementation**:
```typescript
'use client'

import { useChat } from 'ai/react'

export function AgenticExplorer({ dataset }) {
  const { messages, append, isLoading } = useChat({
    api: '/api/agentic-explore',

    // Real-time tool call updates
    onToolCall: ({ toolCall }) => {
      console.log(`🔧 ${toolCall.toolName}`, toolCall.args)
    }
  })

  return (
    <div className="exploration-stream">
      {messages.map((message) => (
        <div key={message.id}>
          {/* AI thinking/text */}
          {message.content && (
            <div className="thinking">💭 {message.content}</div>
          )}

          {/* Tool calls with real-time status */}
          {message.toolInvocations?.map((tool, idx) => (
            <div key={idx} className="tool-call">
              <div className="tool-header">
                🔧 {tool.toolName}
                {tool.state === 'call' && <span>⏳ Executing...</span>}
                {tool.state === 'result' && <span>✅ Complete</span>}
              </div>
              {tool.state === 'result' && (
                <pre>{JSON.stringify(tool.result, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

**Tasks**:
- [x] Install `@ai-sdk/react` package for `useChat` hook
- [x] Create streaming UI component with useChat integration
- [x] Display tool calls in real-time from message.parts
- [x] Show tool execution status (executing → complete → error)
- [x] Style tool call cards with shadcn/ui components
- [x] Fix duplicate key warnings with Set-based deduplication
- [x] Test streaming with backend ✅

### Step 1.5: Test and validate streaming (2-3 hours) ✅

**Test Cases**:
1. Simple aggregation: "What's the average sales?"
   - Verify: See tool call in real-time
2. Filtering: "Show top 10 customers by revenue"
   - Verify: See query execution → results
3. Grouping: "Sales by category"
   - Verify: Multiple tool calls stream correctly
4. Error handling: Invalid query syntax
   - Verify: Error shows in stream
5. Multi-step: "What trends exist in the data?"
   - Verify: See all steps stream sequentially

**Tasks**:
- [x] Create test page at /test-agentic with sample data
- [x] Test streaming with sample questions
- [x] Verify real-time tool call updates work correctly ✅
- [x] Verify AI SDK v5 integration (convertToModelMessages, toUIMessageStreamResponse)
- [x] Fix duplicate key warnings during streaming
- [x] Confirm 28 queries executed successfully in test
- [ ] Full integration testing with actual uploaded data (requires DuckDB setup)

**Status**: ✅ Streaming POC complete and working! DuckDB integration pending for actual data analysis.

### Step 1.6: Update existing report endpoint (1-2 hours)

**Files to modify**:
- `app/api/report/route.ts` - Enhance to accept exploration results

**Tasks**:
- [ ] Add optional `explorationResults` parameter to request schema
- [ ] Handle both agentic exploration results and legacy sqlHistory
- [ ] Format exploration results for report generation prompt
- [ ] Test report generation from exploration results

**Implementation**:
```typescript
const RequestSchema = z.object({
  question: z.string(),
  schema: z.array(...),

  // NEW: Accept exploration results from agentic-explore
  explorationResults: z.object({
    summary: z.string(),
    insights: z.array(z.string()),
    executedQueries: z.array(...),
    charts: z.array(...)
  }).optional(),

  // Legacy support
  sqlHistory: z.array(...).optional(),
  charts: z.array(...).optional()
})
```

**Deliverable**: Two-stage streaming system working end-to-end:
- Stage 1: `/api/agentic-explore` streams exploration with real-time tool calls
- UI: Shows tool execution in real-time
- Stage 2: User triggers `/api/report` to generate full report

---

## Phase 2: Full Tool Suite (5-7 days)

**Goal**: Add visualization, profiling, and validation tools to the agentic exploration endpoint.

**Note**: All tools are used in Stage 1 (Exploration). They gather data and create visualizations, but do NOT generate the final report. The user still manually triggers Stage 2 (Report Generation).

### Step 2.1: Visualization tool (4-5 hours)

**Files to create**:
- `lib/tools/visualization.ts` - Chart creation tool

**Implementation**:
```typescript
export const visualizationTool = tool({
  description: "Create a Vega-Lite visualization",
  parameters: z.object({
    chartType: z.enum(["bar", "line", "scatter", "area"]),
    spec: z.object({...}),
    sqlQuery: z.string(),
    title: z.string()
  }),
  execute: async ({ chartType, spec, sqlQuery, title }) => {
    // 1. Validate Vega-Lite spec
    // 2. Execute SQL to get data
    // 3. Inject data into spec
    // 4. Store chart reference
    // 5. Return confirmation
  }
})
```

**Tasks**:
- [ ] Implement spec validation
- [ ] Integrate with SQL executor
- [ ] Apply consistent theming
- [ ] Store chart metadata
- [ ] Test with different chart types

### Step 2.2: Data profiling tool (3-4 hours)

**Files to create**:
- `lib/tools/profiler.ts` - Statistical profiling tool

**Implementation**:
```typescript
export const profilerTool = tool({
  description: "Get statistical summary of data",
  parameters: z.object({
    columns: z.array(z.string()).optional(),
    includeDistribution: z.boolean().default(false)
  }),
  execute: async ({ columns, includeDistribution }) => {
    // Generate and execute profiling queries
    // Return summary statistics
  }
})
```

**Tasks**:
- [ ] Implement profiling SQL queries
- [ ] Calculate summary statistics
- [ ] Detect data quality issues
- [ ] Format results for AI consumption
- [ ] Add caching for expensive operations

### Step 2.3: Validation tool (3-4 hours)

**Files to create**:
- `lib/tools/validator.ts` - Analysis validation tool

**Implementation**:
```typescript
export const validatorTool = tool({
  description: "Validate analysis findings",
  parameters: z.object({
    finding: z.string(),
    relatedQuery: z.string()
  }),
  execute: async ({ finding, relatedQuery }) => {
    // Re-run query with validation checks
    // Check sample size, outliers
    // Return validation report
  }
})
```

**Tasks**:
- [ ] Implement validation checks
- [ ] Add statistical tests
- [ ] Flag common pitfalls
- [ ] Return structured validation report

### Step 2.4: Integrate all tools into streaming endpoint (2-3 hours)

**Files to modify**:
- `app/api/agentic-explore/route.ts`

**Tasks**:
- [ ] Add all tools to streaming exploration endpoint
- [ ] Update system prompt to guide tool usage
- [ ] Verify all tools stream correctly in real-time
- [ ] Ensure final message is still brief summary (NOT full report)
- [ ] Test tool combinations with streaming UI
- [ ] Optimize token usage

**Updated Implementation**:
```typescript
const result = streamText({
  model: openai("gpt-4o"),
  tools: {
    executeSQLQuery: sqlExecutorTool,
    createVisualization: visualizationTool,
    profileData: profilerTool,
    validateAnalysis: validatorTool
  },
  stopWhen: stepCountIs(15), // AI SDK v5 API
  system: `You are a data analyst exploring data to answer questions.

  Available tools:
  - executeSQLQuery: Run queries to explore data
  - createVisualization: Create charts to visualize patterns
  - profileData: Get statistical summaries
  - validateAnalysis: Verify findings

  When you have gathered enough insights, provide a BRIEF summary (2-3 sentences).
  DO NOT generate a full report - the user will request that separately.`,
  prompt: question
})

// Return stream - client will see all tool calls in real-time
return result.toTextStreamResponse()
```

**Note**: With streaming, the client automatically receives:
- All tool calls as they happen
- Tool results as they complete
- Final summary when agent stops

No need to manually extract tool calls server-side!

### Step 2.5: Session state management (3-4 hours)

**Files to create**:
- `lib/services/session-manager.ts` - Agent session tracking

**Tasks**:
- [ ] Implement session state structure
- [ ] Track execution history
- [ ] Store generated charts
- [ ] Add session cleanup
- [ ] Implement session recovery

**Deliverable**: Full-featured two-stage agentic system with streaming:
- Stage 1: Real-time streaming exploration with 4 tools
- UI: Shows all tool calls as they happen
- Stage 2: User-triggered report generation via existing `/api/report`

---

## Phase 3: Production Features (5-7 days)

**Goal**: Enhanced UI, error recovery, and production-grade reliability.

**Note**: Streaming is already implemented in Phase 1 & 2! This phase focuses on polish and production readiness.

### Step 3.1: Enhanced streaming UI components (4-5 hours)

**Files to modify**:
- `components/agentic-explorer.tsx` - Enhance with better visuals

**Features to add**:
- [ ] Tool-specific icons and colors
- [ ] Collapsible tool result sections
- [ ] SQL syntax highlighting for queries
- [ ] Chart preview thumbnails
- [ ] Animated transitions between steps
- [ ] Copy-to-clipboard for SQL queries
- [ ] Download buttons for chart specs

**Enhanced UI Example**:
```typescript
function ToolCallDisplay({ tool }) {
  const icons = {
    executeSQLQuery: '🔍',
    createVisualization: '📊',
    profileData: '📈',
    validateAnalysis: '✓'
  }

  return (
    <Collapsible>
      <CollapsibleTrigger>
        <div className="tool-header">
          <span className="tool-icon">{icons[tool.toolName]}</span>
          <span className="tool-name">{tool.toolName}</span>
          <ToolStatus state={tool.state} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {tool.toolName === 'executeSQLQuery' && (
          <SqlDisplay query={tool.args.query} />
        )}
        {tool.state === 'result' && (
          <ResultDisplay result={tool.result} />
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
```

### Step 3.2: Enhanced error handling (3-4 hours)

**Tasks**:
- [ ] Implement retry logic for transient failures
- [ ] Add structured error messages for AI
- [ ] Create error recovery strategies
- [ ] Add fallback mechanisms
- [ ] Log errors for analysis

### Step 3.3: Cost optimization (3-4 hours)

**Strategies**:
- [ ] Truncate large query results before sending to AI
- [ ] Use GPT-4o-mini for validation tool
- [ ] Cache common queries within session
- [ ] Limit context to recent steps only
- [ ] Add cost tracking and limits

### Step 3.4: UI/UX enhancements for two-stage flow (5-6 hours)

**Files to modify**:
- `components/chat-interface.tsx` - Update for two-stage agentic mode

**Features to add for Stage 1 (Exploration)**:
- [ ] Real-time agent activity display (streaming)
- [ ] Tool call visualization with icons
- [ ] Step-by-step progress indicator
- [ ] Query results preview (collapsible)
- [ ] Chart generation animation

**Features to add for Stage 2 (Report Generation)**:
- [ ] "Exploration Complete" state with summary
- [ ] Preview of findings before report generation
- [ ] "Generate Report" button (prominent CTA)
- [ ] "Ask Follow-up" option (restart exploration)
- [ ] Report generation loading state

**UI Flow**:
```
[Ask Question]
  ↓
[Exploration in Progress]
  💭 Step 1: Analyzing data...
  🔧 executeSQLQuery
  💭 Step 2: Creating visualization...
  🔧 createVisualization
  ↓
[Exploration Complete] ← New state!
  ✅ Analysis complete
  📝 Summary: "Found 3 key trends..."
  📊 Created 2 visualizations
  📈 Executed 4 queries

  [Generate Full Report] [Ask Follow-up]
  ↓ (user clicks Generate Report)
[Report Loading...]
  ↓
[Final Report Display]
```

### Step 3.5: Testing & quality assurance (4-5 hours)

**Test Suite**:
- [ ] Unit tests for each tool
- [ ] Integration tests for agentic loop
- [ ] End-to-end tests with real questions
- [ ] Performance benchmarks
- [ ] Cost analysis

**Deliverable**: Production-ready two-stage agentic system with:
- Stage 1: Streaming exploration with real-time feedback
- Stage 2: User-controlled report generation

---

## Phase 4: Deployment & Monitoring (3-5 days)

**Goal**: Deploy, monitor, and iterate based on real usage.

### Step 4.1: Monitoring setup (3-4 hours)

**Files to create**:
- `lib/services/telemetry.ts` - Logging and metrics

**Metrics to track**:
- [ ] Step count per analysis
- [ ] Tool usage distribution
- [ ] Token consumption
- [ ] Error rates
- [ ] Completion time
- [ ] User satisfaction signals

### Step 4.2: A/B testing infrastructure (4-5 hours)

**Implementation**:
- [ ] Feature flag for two-stage agentic vs. current single-stage
- [ ] Random user assignment to test groups
- [ ] Quality comparison metrics (accuracy, completeness)
- [ ] Cost comparison tracking (token usage per analysis)
- [ ] User feedback collection (which approach do users prefer?)
- [ ] Track "Generate Report" button click-through rate
- [ ] Measure follow-up question rate (flexibility indicator)

### Step 4.3: Documentation (3-4 hours)

**Documents to create**:
- [ ] User guide for agentic mode
- [ ] Developer docs for adding tools
- [ ] Troubleshooting guide
- [ ] API documentation
- [ ] Architecture diagrams

### Step 4.4: Gradual rollout (ongoing)

**Rollout stages**:
1. **Internal testing** (1 week)
   - Use internally only
   - Fix critical bugs
   - Refine prompts

2. **Beta testing** (2 weeks)
   - 10% of users
   - Collect feedback
   - Monitor metrics
   - Compare to baseline

3. **Gradual expansion** (2-3 weeks)
   - 25% → 50% → 75% → 100%
   - Monitor stability
   - Adjust based on data

4. **Full migration** or **Hybrid**
   - Based on results, either:
     - Replace old system entirely
     - Keep both (user choice or auto-select)

**Deliverable**: Agentic system running in production with monitoring.

---

## Development Guidelines

### Coding Standards

1. **Type Safety**: All tools must have Zod schemas
2. **Error Handling**: Every tool must return structured errors
3. **Testing**: Minimum 80% coverage for tool logic
4. **Logging**: Use structured logging for all tool executions
5. **Documentation**: JSDoc comments for all public functions

### Git Workflow

```bash
# For each major step:
git checkout -b feature/agentic-{step-name}
# ... make changes ...
git commit -m "feat: implement {step-name}"
git push origin feature/agentic-{step-name}
# Create PR, review, merge to feature/agentic-architecture
```

### Testing Checklist

Before marking any step complete:
- [ ] Unit tests pass
- [ ] TypeScript compiles (`pnpm tsc --noEmit`)
- [ ] Manual testing with 3+ examples
- [ ] Token usage measured
- [ ] Error cases handled
- [ ] Documentation updated

---

## Timeline Summary

| Phase | Duration | Key Deliverable |
|-------|----------|----------------|
| Phase 1: POC | 4-6 days | **Streaming** exploration endpoint + basic UI + enhanced report |
| Phase 2: Full Tools | 5-7 days | All 4 tools streaming in real-time |
| Phase 3: Production | 5-7 days | Enhanced streaming UI, error recovery, polish |
| Phase 4: Deployment | 3-5 days + ongoing | Monitoring, A/B testing, gradual rollout |
| **Total** | **17-25 days** | Production two-stage **streaming** agentic system |

---

## Decision Log

Track key decisions as we implement:

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| TBD | Use streaming or batch? | TBD | UX, complexity |
| TBD | GPT-4o for all tools? | TBD | Cost, quality |
| TBD | Tool granularity level? | TBD | Flexibility vs. complexity |

---

## Success Metrics

### MVP (End of Phase 2)
- [ ] Exploration completes successfully 90% of the time
- [ ] Average steps: 5-10 per exploration
- [ ] Exploration token cost: < $0.08
- [ ] Report generation token cost: < $0.05
- [ ] Total cost per full analysis (exploration + report): < $0.15
- [ ] Quality: ≥ current system

### Production (End of Phase 4)
- [ ] 95% exploration completion rate
- [ ] User satisfaction: +15% vs. baseline
- [ ] 70%+ of explorations result in report generation (shows value)
- [ ] Cost per full analysis: < $0.10
- [ ] P95 latency: Exploration < 30s, Report < 15s
- [ ] Zero security incidents
- [ ] Users appreciate the two-stage control (feedback metric)

---

## Key Architectural Decisions Made

### ✅ Two-Stage Approach (User-Controlled)

**Decision**: Separate exploration from report generation
- **Stage 1**: Agentic exploration with tools → brief summary
- **Stage 2**: User-triggered report generation

**Rationale**:
- User control over expensive operations
- Flexibility to ask follow-ups before committing to report
- Clear separation of concerns
- Better cost awareness

**Impact**:
- New endpoint: `/api/agentic-explore`
- Enhanced endpoint: `/api/report` (accepts exploration results)
- New UI state: "Exploration Complete" with CTA

### stopWhen Behavior in Two-Stage System

- `noToolCallsInLastStep()` triggers end of exploration (NOT report generation)
- AI returns brief summary when tools no longer needed
- User reviews and manually triggers report generation
- Report generation is simple text generation (no tools, no stopWhen)

## Next Immediate Steps

1. **Review this roadmap** - Discuss timeline and priorities
2. **Commit design documents** to feature branch
3. **Set up development environment** - Install DuckDB dependencies
4. **Create Phase 1 sub-branch** - Start with POC
5. **Begin Step 1.1** - Tool infrastructure

Ready to start? Let me know if you want to:
- Commit the design documents now
- Adjust the timeline or priorities
- Add/remove features
- Begin Phase 1 implementation immediately
