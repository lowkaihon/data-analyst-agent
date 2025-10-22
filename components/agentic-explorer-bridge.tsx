"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Loader2, ChevronDown, ChevronRight, Database, CheckCircle2, XCircle } from "lucide-react"
import { validateSQL } from "@/lib/sql-guards"
import type { AsyncDuckDB } from "@duckdb/duckdb-wasm"

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

    // Find all tool calls in messages
    messages.forEach((message) => {
      const parts = (message as any).parts || []

      parts.forEach(async (part: any) => {
        if (
          part.type === "tool-executeSQLQuery" &&
          part.toolCallId &&
          part.state === "input-available" &&
          !processedToolCalls.current.has(part.toolCallId)
        ) {
          // Mark as processed
          processedToolCalls.current.add(part.toolCallId)

          const { query, reason } = part.input || {}

          if (!query) {
            console.error("[SQL Bridge] No query in tool call", part)
            return
          }

          console.log(`[SQL Bridge Client] Executing SQL for ${part.toolCallId}`)
          console.log(`[SQL Bridge Client] Query: ${query}`)

          try {
            // Validate SQL first
            const validation = validateSQL(query)
            if (!validation.isValid) {
              console.error(`[SQL Bridge Client] Invalid SQL:`, validation.error)

              // Send error callback
              await fetch("/api/tool-callback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  toolCallId: part.toolCallId,
                  success: false,
                  error: validation.error || "Invalid SQL query",
                }),
              })

              return
            }

            // Execute SQL in browser DuckDB
            const conn = await db.connect()
            const startTime = performance.now()

            try {
              // Add LIMIT if not present
              const limitedSQL = query.trim().match(/LIMIT\s+\d+/i)
                ? query
                : `${query} LIMIT 1000`

              const result = await conn.query(limitedSQL)
              const executionTimeMs = performance.now() - startTime

              const columns = result.schema.fields.map((f) => f.name)
              const rows = result.toArray().map((row) => Object.values(row))

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
      })
    })
  }, [messages, db])

  // Detect when exploration is complete
  const isComplete = status !== "streaming" && messages.length > 0
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
  const flowItems: Array<{
    type: "text" | "tool"
    id: string
    data: any
  }> = []

  // Track seen IDs to prevent duplicates
  const seenIds = new Set<string>()

  messages.forEach((message, messageIndex) => {
    const parts = (message as any).parts || []

    // Process all parts in order
    parts.forEach((part: any, partIndex: number) => {
      if (part.type?.startsWith("tool-")) {
        // Generate unique ID - use toolCallId for true uniqueness across updates
        const uniqueId =
          part.toolCallId || part.id || `${message.id}-${part.type}-${partIndex}`
        const fullId = `tool-${uniqueId}`

        // Only add if not already seen
        if (!seenIds.has(fullId)) {
          seenIds.add(fullId)
          flowItems.push({
            type: "tool",
            id: fullId,
            data: part as ToolUIPart,
          })
        }
      }
    })

    // Add text content - one per message
    const textParts = parts.filter((p: any) => p.type === "text")
    const hasTextContent = textParts.length > 0

    if (hasTextContent && message.role === "assistant") {
      const textId = `text-${message.id}`

      // Only add if not already seen
      if (!seenIds.has(textId)) {
        seenIds.add(textId)
        flowItems.push({
          type: "text",
          id: textId,
          data: {
            content: textParts.map((p: any) => p.text).join(""),
          },
        })
      }
    }
  })

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
