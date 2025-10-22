"use client"

// @ts-ignore - ai/react types may not be fully available
import { useChat } from "ai/react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Loader2, ChevronDown, ChevronRight, Database, CheckCircle2, XCircle } from "lucide-react"

interface AgenticExplorerProps {
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
}

export function AgenticExplorer({
  question,
  schema,
  sample,
  rowCount,
  dataDescription,
  onExplorationComplete,
  onGenerateReport,
}: AgenticExplorerProps) {
  const [isExplorationComplete, setIsExplorationComplete] = useState(false)

  const { messages, append, isLoading } = useChat({
    api: "/api/agentic-explore",
    body: {
      question,
      schema,
      sample,
      rowCount,
      dataDescription,
    },

    onToolCall: ({ toolCall }: any) => {
      console.log(`🔧 Tool called: ${toolCall.toolName}`, toolCall.args)
    },

    onFinish: (message: any) => {
      console.log("✅ Exploration complete", message)
      setIsExplorationComplete(true)
      if (onExplorationComplete && message.content) {
        onExplorationComplete(message.content)
      }
    },

    onError: (error: any) => {
      console.error("❌ Exploration error:", error)
    },
  })

  // Start exploration automatically on mount
  useState(() => {
    if (messages.length === 0) {
      append({ role: "user", content: question })
    }
  })

  return (
    <div className="space-y-4">
      <div className="exploration-stream space-y-3">
        {messages.map((message: any, messageIdx: number) => (
          <div key={message.id}>
            {/* AI thinking/text */}
            {message.content && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">💭</div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tool calls with real-time status */}
            {message.toolInvocations?.map((tool: any, toolIdx: number) => (
              <ToolCallDisplay key={`${messageIdx}-${toolIdx}`} tool={tool} />
            ))}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && !isExplorationComplete && (
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
      {isExplorationComplete && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              Exploration Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="secondary">
                {messages[messages.length - 1]?.toolInvocations?.length || 0} queries
                executed
              </Badge>
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
  tool: any
}

function ToolCallDisplay({ tool }: ToolCallDisplayProps) {
  const [isOpen, setIsOpen] = useState(true)

  // Tool status
  const isExecuting = tool.state === "call"
  const isComplete = tool.state === "result"
  const hasError = isComplete && tool.result?.success === false

  return (
    <Card className={hasError ? "border-red-200 dark:border-red-800" : ""}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Database className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm font-medium">
                  {tool.toolName === "executeSQLQuery" ? "SQL Query" : tool.toolName}
                </CardTitle>
                {isExecuting && (
                  <Badge variant="outline" className="ml-2">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Executing...
                  </Badge>
                )}
                {isComplete && !hasError && (
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
            {/* Tool arguments */}
            {tool.args && (
              <div className="space-y-2">
                {tool.args.reason && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Reason:</p>
                    <p className="text-sm">{tool.args.reason}</p>
                  </div>
                )}
                {tool.args.query && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Query:</p>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                      <code>{tool.args.query}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Tool result */}
            {isComplete && tool.result && (
              <div className="space-y-2">
                {hasError ? (
                  <div className="bg-red-50 dark:bg-red-950 p-3 rounded-md">
                    <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                      Error: {tool.result.error}
                    </p>
                    {tool.result.hint && (
                      <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                        💡 Hint: {tool.result.hint}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Result:</p>
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-xs text-muted-foreground mb-2">
                        {tool.result.data?.rowCount || 0} rows returned in{" "}
                        {tool.result.data?.executionTimeMs || 0}ms
                      </p>
                      {tool.result.data && tool.result.data.rows.length > 0 && (
                        <div className="overflow-x-auto max-h-48 overflow-y-auto">
                          <pre className="text-xs">
                            <code>
                              {JSON.stringify(
                                tool.result.data.rows.slice(0, 5).map((row: any[]) => {
                                  const obj: Record<string, any> = {}
                                  tool.result.data.columns.forEach((col: string, idx: number) => {
                                    obj[col] = row[idx]
                                  })
                                  return obj
                                }),
                                null,
                                2,
                              )}
                              {tool.result.data.rows.length > 5 &&
                                `\n... ${tool.result.data.rows.length - 5} more rows`}
                            </code>
                          </pre>
                        </div>
                      )}
                    </div>
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
