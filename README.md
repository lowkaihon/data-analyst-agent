# Data Analyst Agent

An AI-powered data analysis application that allows users to upload CSV files and perform interactive data analysis through a conversational interface powered by OpenAI's GPT-4o.

[![Built with Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![DuckDB](https://img.shields.io/badge/DuckDB-WASM-yellow?style=for-the-badge)](https://duckdb.org/)

## Features

- **CSV File Upload** - Drag-and-drop interface with validation (max 20MB, 200 columns)
- **AI-Powered Analysis Planning** - GPT-4 generates step-by-step analysis plans based on user questions
- **Interactive Chat Interface** - Conversational data exploration with plan approval workflow
- **In-Browser SQL Execution** - DuckDB-WASM for fast, client-side SQL query execution
- **Data Visualization** - Automatic chart generation using Vega-Lite
- **Data Preview** - Paginated table view with 25/50/100/250 rows per page options
- **Schema Analysis** - Column type information and dataset metadata
- **SQL History Tracking** - Review all executed queries with timestamps and execution times
- **Report Generation** - AI-generated markdown reports with manual editing
- **Automatic Date Parsing** - Intelligent date column detection and conversion
- **Query Execution Timing** - Track and display query performance metrics

## Tech Stack

### Frontend
- **Next.js 15.2.4** (React 19) with TypeScript
- **Tailwind CSS 4.1.9** for styling
- **Radix UI** for accessible component primitives
- **Lucide React** for icons
- **Sonner** for toast notifications

### Data Processing
- **DuckDB-WASM** - In-browser SQL database
- **Vega-Lite** - Declarative visualization grammar
- **Zod** - Schema validation and type safety

### AI/LLM
- **Vercel AI SDK** - LLM integration
- **OpenAI SDK** - GPT-4 model integration

### Testing
- **Jest** - Unit testing framework
- **React Testing Library** - Component testing
- **Playwright** - E2E testing

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn or pnpm
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd data-analyst-agent
```

2. Install dependencies:
```bash
npm install
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
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### 1. Upload Data
- Drag and drop a CSV file (max 20MB, 200 columns)
- Or click to browse and select a file
- The app automatically detects and parses date columns

### 2. Ask Questions
- Type your analysis question in the chat interface
- The AI will generate a step-by-step analysis plan
- Review and approve the plan to execute it

### 3. View Results
- **Preview Tab**: Browse your data with pagination
- **Schema Tab**: View column types and metadata
- **SQL History**: Review all executed queries with execution times
- **Charts**: See generated visualizations
- **Report**: Access AI-generated analysis reports

### 4. Execute Custom SQL
- Click on SQL query cards to execute them
- All queries are validated for safety (read-only)
- Results appear in the Preview tab

## Architecture

### Project Structure

```
data-analyst-agent/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   │   ├── ask/             # AI plan generation
│   │   └── report/          # Report generation
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Main application
│   └── globals.css          # Global styles
├── components/              # React components
│   ├── ui/                  # Radix UI primitives
│   ├── chat-interface.tsx   # Chat UI
│   ├── data-tabs.tsx        # Data display tabs
│   ├── upload-zone.tsx      # File upload
│   ├── plan-card.tsx        # AI plan display
│   ├── sql-card.tsx         # SQL execution
│   ├── chart-card.tsx       # Chart rendering
│   └── loading-skeletons.tsx # Loading states
├── lib/                     # Utility libraries
│   ├── duckdb.ts           # Database operations
│   ├── schemas.ts          # Zod schemas
│   ├── vega-types.ts       # Vega-Lite types
│   ├── sql-guards.ts       # SQL validation
│   ├── time-parsing.ts     # Date detection
│   ├── profiling.ts        # Data profiling
│   ├── errors.ts           # Error types
│   └── __tests__/          # Unit tests
├── e2e/                    # Playwright E2E tests
└── public/                 # Static assets
```

### Data Flow

```
User Upload CSV
    ↓
Load into DuckDB (t_raw table)
    ↓
Auto-detect & parse dates (t_parsed view)
    ↓
Extract schema + sample data
    ↓
User asks question
    ↓
Send to GPT-4 with context
    ↓
Receive analysis plan
    ↓
User approves plan
    ↓
Execute SQL steps
    ↓
Generate visualizations
    ↓
Display results
```

### Security Features

- **SQL Injection Prevention** - Whitelist validation (SELECT/WITH/PRAGMA only)
- **Read-Only Enforcement** - All write operations are blocked
- **Comment Stripping** - SQL comments removed before execution
- **File Validation** - Size, column count, and format checks
- **Privacy-Preserving** - Only schema + small sample sent to LLM
- **Query Timeout** - 30-second default timeout
- **Result Limits** - Automatic LIMIT clause injection

## Testing

### Run Unit Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run E2E Tests
```bash
npm run test:e2e
```

### Run E2E Tests with UI
```bash
npm run test:e2e:ui
```

## API Documentation

### POST /api/ask
Generate an analysis plan based on a user question.

**Request Body:**
```typescript
{
  question: string
  schema: ColumnInfo[]
  sample: Record<string, unknown>[]
  rowCount: number
  dataDescription?: string
}
```

**Response:**
```typescript
{
  plan: {
    reasoning: string
    steps: Array<{
      step: number
      description: string
      sql?: string
      chartSpec?: VegaLiteSpec
    }>
  }
}
```

### POST /api/report
Generate a markdown report from analysis results.

**Request Body:**
```typescript
{
  sqlHistory: SQLHistoryItem[]
  charts: ChartItem[]
  schema: ColumnInfo[]
}
```

**Response:**
```typescript
{
  report: string  // Markdown formatted
}
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 | Yes |

### Configurable Limits

Edit these in the source code:

- **File Size**: `MAX_FILE_SIZE` in `upload-zone.tsx` (default: 20MB)
- **Max Columns**: `MAX_COLUMNS` in `upload-zone.tsx` (default: 200)
- **Query Timeout**: `timeoutMs` parameter in `executeQuery()` (default: 30s)
- **Result Limit**: `maxRows` parameter in `executeQuery()` (default: 1000)

## Performance Optimizations

- **DuckDB Preloading** - Database initializes on app load
- **Pagination** - Preview tab supports 25/50/100/250 rows per page
- **Query Timing** - Execution time tracked and displayed
- **Loading Skeletons** - Better perceived performance during data loading
- **Client-Side Processing** - All SQL executes in-browser (no server roundtrips)

## Type Safety

The application uses comprehensive TypeScript types:

- **Vega-Lite Specs** - Full type definitions in `lib/vega-types.ts`
- **Zod Schemas** - Runtime validation for API responses
- **Error Types** - Structured error handling with custom error classes
- **Type Guards** - Runtime type checking utilities

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write tests for new features
- Follow TypeScript strict mode
- Use proper error handling with custom error types
- Add JSDoc comments for public APIs
- Run linting before committing: `npm run lint`

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
- Increase timeout in `duckdb.ts`
- Optimize your SQL queries
- Reduce result set size with WHERE clauses

## License

MIT

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [DuckDB-WASM](https://duckdb.org/docs/api/wasm/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Visualizations by [Vega-Lite](https://vega.github.io/vega-lite/)
- AI powered by [OpenAI GPT-4](https://openai.com/)
