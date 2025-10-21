# API Documentation

This document describes the API endpoints and library functions available in the Data Analyst Agent application.

## Table of Contents

- [REST API Endpoints](#rest-api-endpoints)
- [Library Functions](#library-functions)
  - [DuckDB Operations](#duckdb-operations)
  - [SQL Validation](#sql-validation)
  - [Time Parsing](#time-parsing)
  - [Data Profiling](#data-profiling)
  - [Error Handling](#error-handling)

---

## REST API Endpoints

### POST /api/ask

Generates an analysis plan based on a user question using GPT-4.

**Endpoint:** `/api/ask`

**Method:** `POST`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```typescript
{
  question: string              // User's analysis question
  schema: ColumnInfo[]          // Database schema information
  sample: Record<string, unknown>[]  // Sample data rows
  rowCount: number              // Total number of rows in dataset
  dataDescription?: string      // Optional dataset description
}
```

**ColumnInfo Type:**
```typescript
{
  name: string    // Column name
  type: string    // Column data type (e.g., 'VARCHAR', 'INTEGER', 'TIMESTAMP')
}
```

**Response:**
```typescript
{
  plan: {
    reasoning: string           // AI's reasoning for the analysis approach
    steps: Array<{
      step: number             // Step number
      description: string      // Description of the step
      sql?: string            // SQL query to execute (if applicable)
      chartSpec?: VegaLiteSpec // Chart specification (if applicable)
    }>
  }
}
```

**Status Codes:**
- `200 OK` - Successfully generated plan
- `400 Bad Request` - Invalid request body or validation error
- `500 Internal Server Error` - OpenAI API error or server error

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the top 5 products by revenue?",
    "schema": [
      {"name": "product_name", "type": "VARCHAR"},
      {"name": "revenue", "type": "DOUBLE"}
    ],
    "sample": [
      {"product_name": "Widget A", "revenue": 1000},
      {"product_name": "Widget B", "revenue": 1500}
    ],
    "rowCount": 1000
  }'
```

**Example Response:**
```json
{
  "plan": {
    "reasoning": "To find the top 5 products by revenue, we need to sum revenue by product and order descending.",
    "steps": [
      {
        "step": 1,
        "description": "Calculate total revenue by product and select top 5",
        "sql": "SELECT product_name, SUM(revenue) as total_revenue FROM t_parsed GROUP BY product_name ORDER BY total_revenue DESC LIMIT 5",
        "chartSpec": {
          "mark": "bar",
          "encoding": {
            "x": {"field": "product_name", "type": "nominal"},
            "y": {"field": "total_revenue", "type": "quantitative"}
          }
        }
      }
    ]
  }
}
```

---

### POST /api/report

Generates a markdown report from analysis results using GPT-4.

**Endpoint:** `/api/report`

**Method:** `POST`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```typescript
{
  sqlHistory: SQLHistoryItem[]  // History of executed SQL queries
  charts: ChartItem[]           // Generated charts
  schema: ColumnInfo[]          // Database schema
}
```

**SQLHistoryItem Type:**
```typescript
{
  sql: string           // SQL query
  timestamp: Date       // Execution timestamp
  success: boolean      // Whether query succeeded
  executionTimeMs?: number  // Query execution time
}
```

**ChartItem Type:**
```typescript
{
  spec: VegaLiteSpec    // Vega-Lite chart specification
  title?: string        // Chart title
  description?: string  // Chart description
}
```

**Response:**
```typescript
{
  report: string  // Markdown formatted report
}
```

**Status Codes:**
- `200 OK` - Successfully generated report
- `400 Bad Request` - Invalid request body
- `500 Internal Server Error` - OpenAI API error or server error

---

## Library Functions

### DuckDB Operations

Located in `lib/duckdb.ts`

#### getDB()

Initialize or retrieve the DuckDB-WASM singleton instance.

```typescript
async function getDB(): Promise<AsyncDuckDB>
```

**Returns:** Promise resolving to AsyncDuckDB instance

**Example:**
```typescript
const db = await getDB()
```

---

#### loadCSV()

Load a CSV file into a DuckDB table.

```typescript
async function loadCSV(
  db: AsyncDuckDB,
  file: File,
  tableName: string = "t_raw"
): Promise<void>
```

**Parameters:**
- `db` - DuckDB instance
- `file` - CSV file to load
- `tableName` - Target table name (default: "t_raw")

**Throws:** Error if file registration or table creation fails

**Example:**
```typescript
const db = await getDB()
await loadCSV(db, csvFile, "my_data")
```

---

#### executeQuery()

Execute a SQL query with timeout and result limit.

```typescript
async function executeQuery(
  db: AsyncDuckDB,
  sql: string,
  timeoutMs: number = 30000,
  maxRows: number = 1000
): Promise<{
  columns: string[]
  rows: unknown[][]
  executionTimeMs: number
}>
```

**Parameters:**
- `db` - DuckDB instance
- `sql` - SQL query to execute
- `timeoutMs` - Query timeout in milliseconds (default: 30000)
- `maxRows` - Maximum rows to return (default: 1000)

**Returns:** Object containing:
- `columns` - Array of column names
- `rows` - Array of data rows
- `executionTimeMs` - Query execution time in milliseconds

**Throws:** Error if query times out or fails

**Example:**
```typescript
const result = await executeQuery(
  db,
  "SELECT * FROM users WHERE age > 18",
  30000,
  100
)

console.log(`Query took ${result.executionTimeMs}ms`)
console.log(`Columns: ${result.columns.join(', ')}`)
console.log(`Rows: ${result.rows.length}`)
```

---

#### getSchema()

Get table schema information.

```typescript
async function getSchema(
  db: AsyncDuckDB,
  tableName: string
): Promise<Array<{ name: string; type: string }>>
```

**Parameters:**
- `db` - DuckDB instance
- `tableName` - Table name

**Returns:** Array of objects with column name and type

**Example:**
```typescript
const schema = await getSchema(db, "t_parsed")
schema.forEach(col => {
  console.log(`${col.name}: ${col.type}`)
})
```

---

### SQL Validation

Located in `lib/sql-guards.ts`

#### validateSQL()

Validate and sanitize SQL query, ensuring it's read-only.

```typescript
function validateSQL(sql: string): string
```

**Parameters:**
- `sql` - SQL query to validate

**Returns:** Sanitized SQL query

**Throws:** `SQLValidationError` if query is not read-only or empty

**Example:**
```typescript
try {
  const validSQL = validateSQL("SELECT * FROM users")
  // Safe to execute
} catch (error) {
  if (error instanceof SQLValidationError) {
    console.error("Invalid SQL:", error.message)
  }
}
```

---

#### sanitizeSQL()

Remove comments and normalize whitespace in SQL.

```typescript
function sanitizeSQL(sql: string): string
```

**Parameters:**
- `sql` - SQL query to sanitize

**Returns:** Sanitized SQL query

**Example:**
```typescript
const cleaned = sanitizeSQL(`
  SELECT * -- get all users
  FROM users /* table */
`)
// Returns: "SELECT * FROM users"
```

---

#### isReadOnlySQL()

Check if SQL query is read-only (SELECT, WITH, PRAGMA).

```typescript
function isReadOnlySQL(sql: string): boolean
```

**Parameters:**
- `sql` - SQL query to check

**Returns:** `true` if read-only, `false` otherwise

**Example:**
```typescript
isReadOnlySQL("SELECT * FROM users")  // true
isReadOnlySQL("INSERT INTO users")    // false
isReadOnlySQL("DROP TABLE users")     // false
```

---

### Time Parsing

Located in `lib/time-parsing.ts`

#### createParsedView()

Create a view with auto-detected and parsed date columns.

```typescript
async function createParsedView(
  db: AsyncDuckDB,
  sourceTable: string = "t_raw",
  targetView: string = "t_parsed"
): Promise<string[]>
```

**Parameters:**
- `db` - DuckDB instance
- `sourceTable` - Source table name (default: "t_raw")
- `targetView` - Target view name (default: "t_parsed")

**Returns:** Array of parsed column names (with `_date` or `_ts` suffix)

**Algorithm:**
1. Identifies date candidate columns by name (containing "date", "time", "timestamp", etc.)
2. Tests parsing success rate on a sample
3. Adds parsed columns if ≥80% of values parse successfully
4. Adds `_ts` suffix for columns with "time" in name, `_date` for others

**Example:**
```typescript
const db = await getDB()
await loadCSV(db, file)

const parsedColumns = await createParsedView(db, "t_raw", "t_parsed")
console.log("Date columns detected:", parsedColumns)
// Output: ["created_date_date", "last_login_ts"]
```

---

### Data Profiling

Located in `lib/profiling.ts`

#### getSample()

Get sample rows from a table.

```typescript
async function getSample(
  db: AsyncDuckDB,
  tableName: string,
  limit: number = 5
): Promise<Record<string, unknown>[]>
```

**Parameters:**
- `db` - DuckDB instance
- `tableName` - Table name
- `limit` - Number of rows to sample (default: 5)

**Returns:** Array of row objects

**Example:**
```typescript
const sample = await getSample(db, "t_parsed", 10)
console.log(sample)
```

---

### Error Handling

Located in `lib/errors.ts`

#### Error Classes

**AppError** - Base error class
```typescript
class AppError extends Error {
  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: unknown
  )
}
```

**Specialized Error Classes:**
- `FileValidationError` - File validation failures (400)
- `SQLValidationError` - SQL validation failures (400)
- `QueryExecutionError` - Query execution failures (500)
- `DataParsingError` - Data parsing failures (500)
- `APIError` - External API errors (configurable status)
- `SchemaValidationError` - Schema validation errors (400)
- `TimeoutError` - Operation timeouts (408)

**Example:**
```typescript
import { SQLValidationError, formatErrorResponse } from '@/lib/errors'

try {
  validateSQL("DROP TABLE users")
} catch (error) {
  if (error instanceof SQLValidationError) {
    const response = formatErrorResponse(error)
    console.error(response)
    // {
    //   error: {
    //     message: "Only read-only queries allowed",
    //     code: "SQL_VALIDATION_ERROR",
    //     statusCode: 400,
    //     details: { sql: "DROP TABLE users" }
    //   }
    // }
  }
}
```

---

#### Type Guards

```typescript
// Check if error is an AppError
function isAppError(error: unknown): error is AppError

// Check specific error types
function isFileValidationError(error: unknown): error is FileValidationError
function isSQLValidationError(error: unknown): error is SQLValidationError
function isQueryExecutionError(error: unknown): error is QueryExecutionError
function isAPIError(error: unknown): error is APIError
function isError(error: unknown): error is Error

// General type guards
function isString(value: unknown): value is string
function isNumber(value: unknown): value is number
function isObject(value: unknown): value is Record<string, unknown>
function isArray(value: unknown): value is unknown[]
function isNullOrUndefined(value: unknown): value is null | undefined
function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown>
```

---

#### Utility Functions

```typescript
// Extract error message from any error type
function getErrorMessage(error: unknown): string

// Get HTTP status code from error
function getErrorStatusCode(error: unknown): number

// Format error for API response
function formatErrorResponse(error: unknown): ErrorResponse
```

**Example:**
```typescript
try {
  await riskyOperation()
} catch (error) {
  const message = getErrorMessage(error)
  const statusCode = getErrorStatusCode(error)
  const response = formatErrorResponse(error)

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' }
  })
}
```

---

## Type Definitions

### Vega-Lite Types

Located in `lib/vega-types.ts`

Comprehensive TypeScript definitions for Vega-Lite specifications, replacing the use of `any` types.

**Main Types:**
- `VegaLiteSpec` - Complete Vega-Lite specification
- `VegaMark` - Mark type (bar, line, point, etc.)
- `VegaEncoding` - Encoding channels (x, y, color, etc.)
- `VegaField` - Field definition with type, scale, axis
- `VegaData` - Data specification (inline, URL, named)

**Example:**
```typescript
import { VegaLiteSpec } from '@/lib/vega-types'

const chartSpec: VegaLiteSpec = {
  mark: 'bar',
  encoding: {
    x: { field: 'category', type: 'nominal' },
    y: { field: 'value', type: 'quantitative' }
  },
  data: { values: [...] }
}
```

---

## Rate Limiting & Quotas

**OpenAI API:**
- Subject to OpenAI's rate limits and quotas
- Implement retry logic with exponential backoff if needed
- Monitor API usage in OpenAI dashboard

**DuckDB-WASM:**
- Browser memory limits apply
- Recommended max file size: 20MB
- Recommended max columns: 200
- Query timeout: 30 seconds (configurable)

---

## Best Practices

1. **Always validate SQL** before execution using `validateSQL()`
2. **Use timeouts** for all database operations
3. **Implement error handling** using typed error classes
4. **Limit result sets** to avoid browser memory issues
5. **Cache database instance** using the singleton pattern
6. **Type-check API responses** using Zod schemas
7. **Handle BigInt values** when serializing to JSON
8. **Clean up connections** in finally blocks

---

## Examples

### Complete Analysis Workflow

```typescript
import { getDB, loadCSV, executeQuery, getSchema } from '@/lib/duckdb'
import { createParsedView } from '@/lib/time-parsing'
import { validateSQL } from '@/lib/sql-guards'
import { getSample } from '@/lib/profiling'

async function analyzeData(file: File, question: string) {
  // 1. Initialize database
  const db = await getDB()

  // 2. Load CSV
  await loadCSV(db, file, 't_raw')

  // 3. Parse dates
  const parsedColumns = await createParsedView(db, 't_raw', 't_parsed')
  console.log('Parsed date columns:', parsedColumns)

  // 4. Get schema and sample
  const schema = await getSchema(db, 't_parsed')
  const sample = await getSample(db, 't_parsed', 5)

  // 5. Get analysis plan from AI
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, schema, sample })
  })

  const { plan } = await response.json()

  // 6. Execute SQL steps
  for (const step of plan.steps) {
    if (step.sql) {
      const validatedSQL = validateSQL(step.sql)
      const result = await executeQuery(db, validatedSQL)
      console.log(`Step ${step.step} completed in ${result.executionTimeMs}ms`)
    }
  }
}
```
