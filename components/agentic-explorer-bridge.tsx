"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Loader2, ChevronDown, ChevronRight, Database, CheckCircle2, XCircle, BarChart3 } from "lucide-react"
import { validateSQL } from "@/lib/sql-guards"
import type { AsyncDuckDB } from "@duckdb/duckdb-wasm"
import dynamic from "next/dynamic"

// Dynamically import VegaEmbed to avoid SSR issues
const VegaEmbed = dynamic(() => import("react-vega").then((mod) => mod.VegaEmbed), { ssr: false })

interface AgenticExplorerBridgeProps {
  question: string
  schema: Array<{ name: string; type: string }>
  sample: {
    columns: string[]
    rows: any[][]
  }
  rowCount: number
  dataDescription?: string
  onExplorationComplete?: (summary: string) => void
  onGenerateReport?: () => void
  // DuckDB instance for executing SQL
  db: AsyncDuckDB | null
}

type ToolUIPart = {
  type: string
  toolCallId?: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: any
  output?: any
  errorText?: string
}

export function AgenticExplorerBridge({
  question,
  schema,
  sample,
  rowCount,
  dataDescription,
  onExplorationComplete,
  onGenerateReport,
  db,
}: AgenticExplorerBridgeProps) {
  const [hasStarted, setHasStarted] = useState(false)
  const processedToolCalls = useRef(new Set<string>())
  const [generatedCharts, setGeneratedCharts] = useState<Array<{ id: string; spec: any; title: string }>>([])

  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/agentic-explore-bridge", // Use bridge endpoint
      body: {
        schema,
        sample,
        rowCount,
        dataDescription,
      },
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

    // Process tool calls asynchronously
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
            // Mark as processed immediately to prevent duplicates
            processedToolCalls.current.add(part.toolCallId)

            const { query, reason } = part.input || {}

            console.log(`[SQL Bridge Client] Detected tool call:`, {
              toolCallId: part.toolCallId,
              state: part.state,
              hasInput: !!part.input,
              query: query ? `${query.substring(0, 50)}...` : "undefined",
              reason,
            })

            // Validate that we have a query
            if (!query || typeof query !== "string" || !query.trim()) {
              console.error("[SQL Bridge Client] Invalid or missing query in tool call:", {
                toolCallId: part.toolCallId,
                hasInput: !!part.input,
                queryType: typeof query,
                queryValue: query,
              })

              // Send error callback
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

            console.log(`[SQL Bridge Client] Executing SQL for ${part.toolCallId}`)
            console.log(`[SQL Bridge Client] Query: ${query}`)

          try {
            // Validate SQL first (throws on invalid)
            const sanitizedSQL = validateSQL(query)

            // Execute SQL in browser DuckDB
            const conn = await db.connect()
            const startTime = performance.now()

            try {
              // Remove trailing semicolon and add LIMIT if not present
              let limitedSQL = sanitizedSQL.trim().replace(/;+\s*$/, '')

              if (!limitedSQL.match(/LIMIT\s+\d+/i)) {
                limitedSQL = `${limitedSQL} LIMIT 1000`
              }

              const result = await conn.query(limitedSQL)
              const executionTimeMs = performance.now() - startTime

              const columns = result.schema.fields.map((f) => f.name)
              // Convert BigInt values to Numbers to avoid JSON serialization errors
              const rows = result.toArray().map((row) =>
                Object.values(row).map(val =>
                  typeof val === 'bigint' ? Number(val) : val
                )
              )

              console.log(
                `[SQL Bridge Client] Success: ${rows.length} rows in ${executionTimeMs}ms`
              )

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

            console.error(`[SQL Bridge Client] Error executing SQL:`, {
              toolCallId: part.toolCallId,
              error: errorMessage,
              errorType: error instanceof Error ? error.constructor.name : typeof error,
              query: query?.substring(0, 100),
            })

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

        // Handle createVisualization tool calls
        if (
          part.type === "tool-createVisualization" &&
          part.toolCallId &&
          part.state === "input-available" &&
          !processedToolCalls.current.has(part.toolCallId)
        ) {
          // Mark as processed immediately to prevent duplicates
          processedToolCalls.current.add(part.toolCallId)

          const { sqlQuery, vegaLiteSpec, title, reason, chartType } = part.input || {}

          console.log(`[Visualization Bridge Client] Detected tool call:`, {
            toolCallId: part.toolCallId,
            chartType,
            title,
            reason,
          })

          // Validate inputs
          if (!sqlQuery || !vegaLiteSpec || !title) {
            console.error("[Visualization Bridge Client] Invalid inputs:", {
              hasSqlQuery: !!sqlQuery,
              hasVegaLiteSpec: !!vegaLiteSpec,
              hasTitle: !!title,
            })

            await fetch("/api/tool-callback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                toolCallId: part.toolCallId,
                success: false,
                error: "Missing required fields for visualization",
              }),
            })

            continue
          }

          console.log(`[Visualization Bridge Client] Executing SQL for chart`)

          try {
            // Validate and execute SQL
            const sanitizedSQL = validateSQL(sqlQuery)
            let limitedSQL = sanitizedSQL.trim().replace(/;+\s*$/, '')
            if (!limitedSQL.match(/LIMIT\s+\d+/i)) {
              limitedSQL = `${limitedSQL} LIMIT 1000`
            }

            const conn = await db.connect()
            const startTime = performance.now()

            try {
              const result = await conn.query(limitedSQL)
              const executionTimeMs = performance.now() - startTime

              const columns = result.schema.fields.map((f) => f.name)
              const rows = result.toArray().map((row) =>
                Object.values(row).map(val =>
                  typeof val === 'bigint' ? Number(val) : val
                )
              )

              console.log(`[Visualization Bridge Client] SQL Success: ${rows.length} rows`)

              // Convert rows to Vega-Lite data format
              const chartData = rows.map((row) => {
                const dataPoint: Record<string, unknown> = {}
                columns.forEach((col, idx) => {
                  dataPoint[col] = row[idx]
                })
                return dataPoint
              })

              // Inject data into Vega-Lite spec
              const enrichedSpec = {
                ...vegaLiteSpec,
                data: { values: chartData },
                title: title,
              }

              // Store chart for display
              setGeneratedCharts((prev) => [
                ...prev,
                {
                  id: part.toolCallId,
                  spec: enrichedSpec,
                  title,
                },
              ])

              console.log(`[Visualization Bridge Client] Chart generated successfully`)

              // Send success callback
              await fetch("/api/tool-callback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  toolCallId: part.toolCallId,
                  success: true,
                  result: {
                    success: true,
                    chartGenerated: true,
                    dataPoints: chartData.length,
                    executionTimeMs: Math.round(executionTimeMs),
                  },
                }),
              })
            } finally {
              await conn.close()
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)

            console.error(`[Visualization Bridge Client] Error:`, {
              toolCallId: part.toolCallId,
              error: errorMessage,
            })

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

    // Call the async function
    processToolCalls().catch((error) => {
      console.error("[SQL Bridge Client] Error processing tool calls:", error)
    })
  }, [messages, db])

  // Detect when exploration is complete - only when we have assistant responses
  const hasAssistantResponse = messages.some(
    (m) => m.role === "assistant" && (m as any).parts?.length > 0
  )
  const isComplete = status !== "streaming" && hasAssistantResponse
  const isExploring = status === "streaming"

  // Notify parent when complete
  useEffect(() => {
    if (isComplete && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === "assistant") {
        const textParts = (lastMessage as any).parts?.filter((p: any) => p.type === "text") || []
        const content = textParts.map((p: any) => p.text).join("")
        if (content) {
          onExplorationComplete?.(content)
        }
      }
    }
  }, [isComplete, messages])

  // Extract all flow items (text and tools) from messages
  // Use Map to allow updates when state changes during streaming
  const flowItemsMap = new Map<string, {
    type: "text" | "tool"
    id: string
    data: any
  }>()

  messages.forEach((message, messageIndex) => {
    const parts = (message as any).parts || []

    // Process all parts in order
    parts.forEach((part: any, partIndex: number) => {
      if (part.type?.startsWith("tool-")) {
        // Generate unique ID - use toolCallId for true uniqueness across updates
        const uniqueId =
          part.toolCallId || part.id || `${message.id}-${part.type}-${partIndex}`
        const fullId = `tool-${uniqueId}`

        // Update or add tool call (allows state updates during streaming)
        flowItemsMap.set(fullId, {
          type: "tool",
          id: fullId,
          data: part as ToolUIPart,
        })
      }
    })

    // Add text content - one per message
    const textParts = parts.filter((p: any) => p.type === "text")
    const hasTextContent = textParts.length > 0

    if (hasTextContent && message.role === "assistant") {
      const textId = `text-${message.id}`

      // Update or add text content (allows updates during streaming)
      flowItemsMap.set(textId, {
        type: "text",
        id: textId,
        data: {
          content: textParts.map((p: any) => p.text).join(""),
        },
      })
    }
  })

  // Convert map to array for rendering
  const flowItems = Array.from(flowItemsMap.values())

  const toolCallCount = flowItems.filter((item) => item.type === "tool").length

  return (
    <div className="space-y-4">
      {!db && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ DuckDB not initialized. SQL queries will not execute.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="exploration-stream space-y-3">
        {flowItems.map((item) => {
          if (item.type === "tool") {
            return <ToolCallDisplay key={item.id} tool={item.data} />
          } else {
            return (
              <Card key={item.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">💭</div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {item.data.content}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          }
        })}

        {/* Display generated charts */}
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

        {/* Loading indicator */}
        {isExploring && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="text-sm text-muted-foreground">Analyzing data...</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Exploration complete state */}
      {isComplete && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              Exploration Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="secondary">{toolCallCount} queries executed</Badge>
            </div>

            {onGenerateReport && (
              <Button onClick={onGenerateReport} className="w-full">
                Generate Full Report
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface ToolCallDisplayProps {
  tool: ToolUIPart
}

function ToolCallDisplay({ tool }: ToolCallDisplayProps) {
  const [isOpen, setIsOpen] = useState(true)

  const isExecuting = tool.state === "input-streaming" || tool.state === "input-available"
  const isComplete = tool.state === "output-available"
  const hasError = tool.state === "output-error"

  // Extract tool name from type (e.g., "tool-executeSQLQuery" -> "SQL Query")
  const toolName = tool.type.replace("tool-", "")
  const displayName = toolName === "executeSQLQuery" ? "SQL Query" : toolName

  return (
    <Card className={hasError ? "border-red-200 dark:border-red-800" : ""}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Database className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm font-medium">{displayName}</CardTitle>
                {isExecuting && (
                  <Badge variant="outline" className="ml-2">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Executing...
                  </Badge>
                )}
                {isComplete && (
                  <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                )}
                {hasError && (
                  <Badge variant="outline" className="ml-2 text-red-600 border-red-600">
                    <XCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-3">
            {/* Tool input */}
            {tool.input && (
              <div className="space-y-2">
                {tool.input.reason && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Reason:</p>
                    <p className="text-sm">{tool.input.reason}</p>
                  </div>
                )}
                {tool.input.query && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Query:</p>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                      <code>{tool.input.query}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Tool output */}
            {tool.output && (
              <div className="space-y-2">
                {hasError ? (
                  <div className="bg-red-50 dark:bg-red-950 p-3 rounded-md">
                    <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                      Error: {tool.errorText || tool.output.error || "Unknown error"}
                    </p>
                    {tool.output.hint && (
                      <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                        💡 Hint: {tool.output.hint}
                      </p>
                    )}
                  </div>
                ) : tool.output.success !== false ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Result:</p>
                    <div className="bg-muted p-3 rounded-md">
                      {tool.output.data && (
                        <>
                          <p className="text-xs text-muted-foreground mb-2">
                            {tool.output.data.rowCount || 0} rows returned in{" "}
                            {tool.output.data.executionTimeMs || 0}ms
                          </p>
                          {tool.output.data.rows && tool.output.data.rows.length > 0 && (
                            <div className="overflow-x-auto max-h-48 overflow-y-auto">
                              <pre className="text-xs">
                                <code>
                                  {JSON.stringify(
                                    tool.output.data.rows.slice(0, 5).map((row: any[]) => {
                                      const obj: Record<string, any> = {}
                                      tool.output.data.columns.forEach((col: string, idx: number) => {
                                        obj[col] = row[idx]
                                      })
                                      return obj
                                    }),
                                    null,
                                    2,
                                  )}
                                  {tool.output.data.rows.length > 5 &&
                                    `\n... ${tool.output.data.rows.length - 5} more rows`}
                                </code>
                              </pre>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 dark:bg-red-950 p-3 rounded-md">
                    <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                      Error: {tool.output.error}
                    </p>
                    {tool.output.hint && (
                      <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                        💡 Hint: {tool.output.hint}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
