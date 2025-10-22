# Data Analyst Agent

An AI-powered data analysis application that allows users to upload CSV files and perform interactive data analysis through a conversational interface. Powered by OpenAI's GPT-4 for intelligent analysis planning and GPT-4o-mini for fast conversational responses.

[![Built with Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![DuckDB](https://img.shields.io/badge/DuckDB-WASM-yellow?style=for-the-badge)](https://duckdb.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)

## Features

### Core Capabilities
- **CSV File Upload** - Drag-and-drop interface with validation (max 20MB, 200 columns)
- **AI-Powered Analysis Planning** - GPT-4 generates step-by-step analysis plans based on user questions
- **Intent Classification** - Smart detection of whether user wants analysis or conversation
- **Interactive Chat Interface** - Conversational data exploration with plan approval/rejection workflow
- **In-Browser SQL Execution** - DuckDB-WASM for fast, client-side SQL query execution (no server required)
- **Data Visualization** - Automatic chart generation using Vega-Lite with professional styling
- **Report Generation** - AI-generated markdown reports based on actual analysis results with manual editing and download

### Data Management
- **Data Preview** - Paginated table view with 25/50/100/250 rows per page options
- **Schema Analysis** - Column type information, null counts, and dataset metadata
- **SQL History Tracking** - Review all executed queries with timestamps and execution times
- **Automatic Date Parsing** - Intelligent date column detection and conversion using pattern recognition
- **Data Profiling** - Automatic statistics for numeric columns and top values for categorical data

### Security & Performance
- **SQL Injection Prevention** - Whitelist validation (SELECT/WITH/PRAGMA only) with comment stripping
- **Read-Only Enforcement** - All write operations blocked at validation layer
- **Query Timeout Protection** - 30-second default timeout with automatic LIMIT clause injection
- **Privacy-Preserving** - Only schema + 5-row sample sent to LLM, full data stays in browser
- **Query Execution Timing** - Track and display query performance metrics

## Tech Stack

### Frontend
- **Next.js 15.2.4** (React 19) with TypeScript 5 and App Router
- **Tailwind CSS 4.1.9** for modern styling
- **Radix UI** for accessible component primitives (Dialog, Tabs, etc.)
- **Lucide React** for icons
- **Sonner** for toast notifications
- **React Resizable Panels** for collapsible layouts
- **React Hook Form** for form management

### Data Processing
- **DuckDB-WASM** - In-browser SQL database (WebAssembly) with Apache Arrow support
- **Vega-Lite** - Declarative visualization grammar with Vega-Embed rendering
- **Zod** - Schema validation and runtime type safety

### AI/LLM
- **Vercel AI SDK** - Unified LLM integration framework with structured output
- **OpenAI SDK** (@ai-sdk/openai) - GPT-4 for complex tasks, GPT-4o-mini for fast responses

### Build & Development
- **Turbopack** - Fast bundling via Next.js 15
- **TypeScript 5** - Full type safety with strict mode
- **PostCSS** - CSS processing
- **pnpm** - Package manager (required)

### Testing
- **Jest** - Unit testing framework
- **React Testing Library** - Component testing
- **Playwright** - E2E testing

## Getting Started

### Prerequisites

- Node.js 18+
- **pnpm** (required - this project does not use npm or yarn)
- OpenAI API key with access to GPT-4 and GPT-4o-mini models
- Modern browser with WebAssembly support (Chrome 90+, Firefox 88+, Safari 15+)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd data-analyst-agent
```

2. Install dependencies using pnpm:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Add your OpenAI API key to `.env.local`:
```
OPENAI_API_KEY=your_api_key_here
```

4. Run the development server:
```bash
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
pnpm build
pnpm start
```

### Type Checking

Always run TypeScript check before committing:
```bash
pnpm tsc --noEmit
```

## Usage

### Complete Workflow

#### 1. Upload Data
1. Drag and drop a CSV file (max 20MB, 200 columns) or click to browse
2. Optionally provide a description of what the data represents
3. Click "Proceed to Analysis"
4. The app will:
   - Load data into in-browser DuckDB database
   - Auto-detect and parse date columns (creates `t_parsed` view)
   - Extract schema and generate preview
   - Display a personalized greeting with data insights

#### 2. Ask Questions
1. Type your question in the chat interface (e.g., "What are the top 5 products by revenue?")
2. The AI classifies your intent:
   - **Analysis**: Generates a step-by-step plan with SQL queries and visualizations
   - **Chat**: Provides conversational responses to general questions
3. For analysis requests:
   - Review the AI-generated plan with reasoning and steps
   - Click "Approve" to execute or "Reject" to try a different question

#### 3. Plan Execution
1. Steps execute sequentially with natural pacing
2. Each step shows:
   - Description of what's being analyzed
   - SQL query (auto-executed)
   - Results displayed in tables or charts
   - Execution time
3. Charts are automatically generated from SQL results
4. All queries and results are saved to history

#### 4. View Results
Navigate through tabs to explore your analysis:
- **Preview Tab**: Browse data with pagination (25/50/100/250 rows per page)
- **Schema Tab**: View column types, null counts, and metadata
- **SQL History**: Review all executed queries with timestamps and execution times
- **Charts Tab**: Gallery view of all generated visualizations
- **Report Tab**: AI-generated markdown report with manual editing and download

#### 5. Generate Reports
1. Click "Generate Report" after completing analysis
2. GPT-4 creates a professional markdown report including:
   - Analysis summary and methodology
   - Key findings backed by actual SQL results
   - Statistics, patterns, and trends
   - Actionable conclusions
3. Edit the report inline if needed
4. Download as `.md` file

### Additional Features

**Conversational Chat**: Ask general questions about your data without triggering full analysis (e.g., "What columns do I have?", "How many rows are in my dataset?")

**Plan Rejection**: If the AI's plan doesn't match your needs, reject it and ask your question differently

**SQL History**: Click any previous query to re-execute it

**Chart Export**: Download visualizations as SVG or PNG

## Architecture

### Project Structure

```
data-analyst-agent/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── ask/route.ts         # Plan generation (GPT-4)
│   │   ├── chat/route.ts        # Conversational chat (GPT-4o-mini)
│   │   ├── chat-response/route.ts # Context messages (greeting, plan intro, completion)
│   │   ├── intent/route.ts      # Intent classification (chat vs analysis)
│   │   └── report/route.ts      # Report generation (GPT-4)
│   ├── layout.tsx               # Root layout with analytics
│   ├── page.tsx                 # Main application (672 lines - all state management)
│   └── globals.css              # Global styles
├── components/                   # React components
│   ├── ui/                      # Radix UI primitives (button, card, input, textarea, tabs)
│   ├── chat-interface.tsx       # Main chat UI with message rendering
│   ├── data-tabs.tsx            # Tabbed interface for data views
│   ├── upload-zone.tsx          # CSV file upload with validation
│   ├── plan-card.tsx            # Analysis plan display with approve/reject
│   ├── sql-card.tsx             # SQL query display with auto-execution
│   ├── chart-card.tsx           # Vega-Lite chart rendering
│   ├── step-card.tsx            # Step progress display
│   ├── preview-tab.tsx          # Data preview with pagination
│   ├── schema-tab.tsx           # Column metadata display
│   ├── sql-history-tab.tsx      # Query history and execution times
│   ├── charts-tab.tsx           # Chart gallery
│   ├── report-tab.tsx           # Report editor and generator
│   └── loading-skeletons.tsx    # Loading placeholders
├── lib/                         # Core libraries
│   ├── duckdb.ts               # Database ops (load CSV, execute SQL, schema)
│   ├── schemas.ts              # Zod schemas (Column, Plan, SQLResult, ChartSpec)
│   ├── vega-types.ts           # Vega-Lite type definitions
│   ├── sql-guards.ts           # SQL validation (read-only enforcement)
│   ├── time-parsing.ts         # Auto-detect and parse date columns
│   ├── profiling.ts            # Data profiling (stats, top values)
│   ├── errors.ts               # Custom error types and guards
│   ├── utils.ts                # Utility functions
│   └── __tests__/              # Unit tests (time-parsing, sql-guards, errors)
├── public/                      # Static assets
├── .claude/settings.local.json  # Claude Code settings
├── jest.config.js              # Jest configuration
├── playwright.config.ts        # E2E test configuration
├── tsconfig.json               # TypeScript configuration
├── next.config.mjs             # Next.js configuration
├── postcss.config.mjs          # PostCSS configuration
├── CLAUDE.md                   # Development guidelines
└── README.md                   # Project documentation
```

### Data Flow

```
1. User Upload CSV
   └─> File validation (size, format, columns)
   └─> Load into DuckDB t_raw table
   └─> Create t_parsed view with parsed dates
   └─> Extract schema and generate preview
   └─> Generate AI greeting message

2. User Provides Data Description (optional)
   └─> Helps AI understand context

3. User Asks Question
   └─> Classify intent via /api/intent (chat vs analysis)

4A. If Intent = "chat"
   └─> Generate conversational response via /api/chat
   └─> Add to chat history

4B. If Intent = "analysis"
   └─> Get data sample (5 rows)
   └─> Send to GPT-4 via /api/ask with schema
   └─> Receive structured analysis plan
   └─> Display plan for approval

5. User Approves Plan
   └─> Begin sequential step execution

6. For Each Step:
   └─> Display step description
   └─> Execute SQL (auto-executed)
   └─> Get results and execution time
   └─> Add to SQL history
   └─> If chartSpec provided:
       └─> Inject SQL results into spec
       └─> Render Vega-Lite visualization
   └─> Small delay for natural pacing

7. Plan Completion
   └─> Display completion message with follow-up suggestions
   └─> Show all results in tabs

8. Report Generation (optional)
   └─> User clicks "Generate Report"
   └─> Send SQL history, charts, schema to GPT-4 via /api/report
   └─> Receive markdown report
   └─> Display in report tab with editing capability
```

### AI Model Strategy

The application uses different OpenAI models strategically:

| Model | Used For | Reason |
|-------|----------|--------|
| **GPT-4** | Plan generation, Report generation | Most capable for complex reasoning and structured output |
| **GPT-4o-mini** | Intent classification, Chat responses, Context messages | Fast, cost-effective for simpler tasks |

### Security Features

1. **SQL Injection Prevention** (lib/sql-guards.ts:5)
   - Whitelist validation: only SELECT, WITH, PRAGMA allowed
   - Forbidden keywords blocked: INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, etc.
   - Comment stripping (-- and /* */ removed)
   - Pattern-based rejection: semicolons, xp_, sp_ prefixes

2. **Read-Only Enforcement**
   - All write operations completely blocked at validation layer
   - Queries validated before execution
   - `SQLValidationError` thrown for invalid queries

3. **File Security** (components/upload-zone.tsx:12)
   - File type validation (CSV only)
   - File size limit (20MB max)
   - Column count limit (200 max)
   - Comprehensive error messages for validation failures

4. **Privacy & Data Protection**
   - Only schema + 5-row sample sent to GPT-4 (not full dataset)
   - Client-side SQL execution (no server processing)
   - DuckDB runs in browser (in-memory, WebAssembly)
   - No data persistence (resets on page reload)

5. **Query Safety**
   - Query timeout (30 seconds default, configurable)
   - Automatic LIMIT clause injection (max 1000 rows)
   - BigInt overflow prevention (conversion to Number)
   - Execution time tracking

## Testing

### Unit Tests

The project includes comprehensive unit tests for core libraries:
- `lib/__tests__/time-parsing.test.ts` - Date detection and parsing
- `lib/__tests__/sql-guards.test.ts` - SQL validation and security
- `lib/__tests__/errors.test.ts` - Error type handling

```bash
pnpm test              # Run all unit tests
pnpm test:watch       # Watch mode for development
pnpm test:coverage    # Generate coverage report
```

### E2E Tests

End-to-end tests using Playwright:

```bash
pnpm test:e2e         # Run E2E tests headless
pnpm test:e2e:ui      # Run E2E tests with UI
```

### Type Checking

**IMPORTANT**: Always run TypeScript check before committing:

```bash
pnpm tsc --noEmit
```

This is required as per CLAUDE.md development guidelines.

## API Documentation

### POST /api/intent
Classify user intent (chat vs analysis).

**Model**: GPT-4o-mini (fast classification)

**Request Body:**
```typescript
{
  message: string                    // User's message
  conversationHistory: Message[]     // Recent conversation context
  dataContext: {
    columns: string[]
    dataDescription?: string
  }
}
```

**Response:**
```typescript
{
  intent: "chat" | "analysis"        // Classification result
  reasoning: string                  // Explanation for debugging
}
```

### POST /api/ask
Generate an analysis plan based on a user question.

**Model**: GPT-4 (complex reasoning)

**Request Body:**
```typescript
{
  question: string                   // User's analysis question
  schema: ColumnInfo[]               // Array of {name, type}
  sample: Record<string, unknown>[]  // First 5 rows of data
  rowCount: number                   // Total rows in dataset
  dataDescription?: string           // User's data context
}
```

**Response:**
```typescript
{
  plan: {
    reasoning: string                // Explanation of approach
    steps: Array<{
      step: number
      description: string
      sql?: string                   // DuckDB SQL query
      chartSpec?: VegaLiteSpec      // Vega-Lite visualization
    }>
  }
}
```

### POST /api/chat
Handle conversational (non-analysis) messages.

**Model**: GPT-4o-mini (fast responses)

**Request Body:**
```typescript
{
  message: string
  conversationHistory: Message[]     // Last 6 messages
  dataContext: {
    fileName: string
    rowCount: number
    columns: string[]
    dataDescription?: string
  }
}
```

**Response:**
```typescript
{
  message: string                    // Natural conversational response
}
```

### POST /api/chat-response
Generate context-aware AI messages.

**Model**: GPT-4o-mini (fast generation)

**Request Body:**
```typescript
{
  context: "greeting" | "plan_intro" | "completion" | "rejection"
  dataContext?: {
    fileName: string
    rowCount: number
    columns: string[]
    dataDescription?: string
  }
  plan?: Plan                        // For plan_intro context
}
```

**Response:**
```typescript
{
  message: string                    // Context-appropriate message
}
```

### POST /api/report
Generate a markdown report from analysis results.

**Model**: GPT-4 (comprehensive reporting)

**Request Body:**
```typescript
{
  question: string                   // Original analysis question
  schema: ColumnInfo[]               // Dataset schema
  sqlHistory: Array<{
    query: string
    result: Record<string, unknown>[]
    executionTime: number
  }>
  charts: Array<{
    chartSpec: VegaLiteSpec
  }>
}
```

**Response:**
```typescript
{
  report: string                     // Markdown formatted report
}
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 | Yes |

### Configurable Limits

Edit these in the source code:

| Setting | Default | Location |
|---------|---------|----------|
| Max file size | 20MB | `components/upload-zone.tsx:MAX_FILE_SIZE` |
| Max columns | 200 | `components/upload-zone.tsx:MAX_COLUMNS` |
| Query timeout | 30 seconds | `lib/duckdb.ts:executeQuery()` |
| Max result rows | 1000 | `app/page.tsx:LIMIT parameter` |
| Conversation history | Last 6 messages | `app/page.tsx:conversationHistory` |
| Date parse threshold | 80% | `lib/time-parsing.ts:MIN_PARSE_RATE` |

## Performance Optimizations

1. **Client-Side Processing**
   - All SQL executes in-browser using DuckDB-WASM (no server roundtrips)
   - Data stays local for privacy and speed
   - WebAssembly for near-native performance

2. **Smart Pagination**
   - Preview tab supports 25/50/100/250 rows per page
   - Reduces DOM rendering overhead for large datasets

3. **Query Optimization**
   - Automatic LIMIT clause injection to prevent massive result sets
   - Query execution time tracking and display
   - Timeout protection (30s default)

4. **Loading States**
   - Skeleton loaders for better perceived performance
   - Progressive rendering of results
   - Sequential step execution with natural pacing

5. **Efficient Data Structures**
   - Apache Arrow for columnar data storage
   - BigInt handling for large numeric values
   - SQL result caching in component state

6. **AI Model Optimization**
   - GPT-4o-mini for fast, inexpensive tasks (intent, chat, context messages)
   - GPT-4 only for complex reasoning (plans, reports)
   - Minimal data sent to LLM (schema + 5 rows max)

## Type Safety

The application uses comprehensive TypeScript types for end-to-end type safety:

### Compile-Time Type Safety
- **TypeScript Strict Mode** - Full strictness enabled in `tsconfig.json`
- **Vega-Lite Specs** - Complete type definitions in `lib/vega-types.ts`
- **Custom Error Types** - Structured error handling in `lib/errors.ts`
- **Type Guards** - Runtime type checking utilities in `lib/errors.ts`

### Runtime Validation
- **Zod Schemas** (`lib/schemas.ts`) - Runtime validation for:
  - `ColumnSchema` - Database column information
  - `StepSchema` - Individual analysis steps
  - `PlanSchema` - Complete analysis plans
  - `SQLResultSchema` - Query execution results
  - `ChartSpecSchema` - Visualization specifications
- **AI Response Validation** - Structured output from OpenAI validated against Zod schemas
- **API Input/Output Validation** - All API routes validate requests and responses

### Custom Error Hierarchy
```typescript
AppError (base)
├── FileValidationError      // File upload issues
├── SQLValidationError       // SQL security violations
├── QueryExecutionError      // Query runtime errors
├── DataParsingError         // Date/data parsing failures
├── APIError                 // External API failures
├── SchemaValidationError    // Zod validation failures
└── TimeoutError            // Query timeout issues
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

As specified in `CLAUDE.md`:

1. **Package Manager**: Use `pnpm` exclusively (not npm or yarn)
2. **Type Checking**: Always run `pnpm tsc --noEmit` after writing/modifying code
3. **Testing**: Write tests for new features in `lib/__tests__/`
4. **Error Handling**: Use custom error types from `lib/errors.ts`
5. **Code Quality**:
   - Follow TypeScript strict mode
   - Add JSDoc comments for public APIs
   - Run `pnpm lint` before committing
6. **Security**: Validate all SQL queries, sanitize user inputs
7. **Privacy**: Minimize data sent to external APIs (schema + sample only)

## Troubleshooting

### Common Issues

**DuckDB initialization fails**
- Clear browser cache and reload
- Check browser console for WebAssembly errors
- Ensure you're using a modern browser (Chrome 90+, Firefox 88+, Safari 15+)

**OpenAI API errors**
- Verify your API key is set correctly in `.env.local`
- Check you have sufficient API credits
- Review OpenAI API status page

**File upload fails**
- Ensure file is under 20MB
- Check CSV has fewer than 200 columns
- Verify CSV is properly formatted

**Queries timeout**
- Increase timeout in `lib/duckdb.ts:executeQuery()` (default: 30s)
- Optimize your SQL queries with proper WHERE clauses
- Reduce result set size with LIMIT clauses
- Check for inefficient joins or aggregations

**Intent classification issues**
- The AI defaults to "analysis" when uncertain
- Try rephrasing your question more explicitly
- For general questions, start with "Can you tell me..." or "What..."
- For analysis, be specific about what insights you want

**Charts not rendering**
- Check browser console for Vega-Lite errors
- Ensure SQL results contain columns referenced in chart spec
- Verify Vega-Embed is loading properly
- Try refreshing the page to reinitialize

## Key Technical Highlights

### Smart Date Parsing
The application automatically detects date columns using a two-step approach:
1. **Name heuristics** - Looks for columns named date, time, timestamp, created, updated, etc.
2. **Sample validation** - Tests parsing on sample data (≥80% success rate required)
3. Creates a `t_parsed` view with properly typed date columns

Located in: `lib/time-parsing.ts:25`

### SQL Security Layer
Multi-layered SQL validation prevents injection and enforces read-only access:
- Whitelist approach (only SELECT, WITH, PRAGMA allowed)
- Keyword blacklist (blocks INSERT, UPDATE, DELETE, DROP, etc.)
- Comment stripping (removes -- and /* */ comments)
- Pattern detection (rejects suspicious patterns like xp_, sp_)

Located in: `lib/sql-guards.ts:5`

### Structured AI Output
Uses Vercel AI SDK's structured output with Zod schemas to ensure:
- Type-safe AI responses
- Guaranteed JSON structure
- Runtime validation
- No parsing errors

Example in: `app/api/ask/route.ts:30`

### DuckDB Table Strategy
- `t_raw` - Original CSV data as loaded
- `t_parsed` - View with date columns converted to proper timestamps
- Queries use `t_parsed` by default for type-correct operations

## Browser Compatibility

### Minimum Requirements
- Chrome 90+ (April 2021)
- Firefox 88+ (April 2021)
- Safari 15+ (September 2021)
- Edge 90+ (April 2021)

### Required Features
- WebAssembly support (for DuckDB)
- ES2020 JavaScript
- SharedArrayBuffer (for DuckDB threading)
- Modern CSS features (for Tailwind CSS 4)

## License

MIT

## Acknowledgments

- Built with [Next.js](https://nextjs.org/) - React framework
- Powered by [DuckDB-WASM](https://duckdb.org/docs/api/wasm/) - In-browser analytics
- UI components from [Radix UI](https://www.radix-ui.com/) - Accessible primitives
- Styled with [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- Visualizations by [Vega-Lite](https://vega.github.io/vega-lite/) - Declarative charts
- AI powered by [OpenAI](https://openai.com/) - GPT-4 and GPT-4o-mini
- Type safety by [Zod](https://zod.dev/) - Runtime validation
- Icons from [Lucide](https://lucide.dev/) - Beautiful icons

## Support

For issues, questions, or contributions, please open an issue on GitHub.
