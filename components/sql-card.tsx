"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"

interface SQLCardProps {
  sql: string
  onExecute: (sql: string) => Promise<void>
  stepNumber?: number
  autoExecute?: boolean
  initialStatus?: "idle" | "running" | "success" | "error"
}

export function SQLCard({
  sql,
  onExecute,
  stepNumber,
  autoExecute = false,
  initialStatus = "idle",
}: SQLCardProps) {
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">(initialStatus)
  const [error, setError] = useState<string | null>(null)

  const handleExecute = async () => {
    setStatus("running")
    setError(null)
    try {
      await onExecute(sql)
      setStatus("success")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Query execution failed")
    }
  }

  // Auto-execute when component mounts if autoExecute is true
  useEffect(() => {
    if (autoExecute) {
      handleExecute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Determine description based on status and autoExecute
  const getDescription = () => {
    if (status === "success") return "Query executed successfully"
    if (status === "running") return "Query executing..."
    if (status === "error") return "Query execution failed"
    if (autoExecute) return "Query executing automatically..."
    return "Click execute to run this query"
  }

  return (
    <Card className={`border-l-4 ${status === "success" ? "border-l-green-500 bg-green-50/30 dark:bg-green-950/10" : status === "error" ? "border-l-red-500 bg-red-50/30 dark:bg-red-950/10" : status === "running" ? "border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10" : "border-l-blue-400"}`}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          SQL Query {stepNumber !== undefined && `(Step ${stepNumber})`}
          {status === "running" && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
          {status === "success" && <CheckCircle className="h-4 w-4 text-green-600" />}
        </CardTitle>
        <CardDescription>{getDescription()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <pre className="bg-muted/50 p-4 rounded-md text-xs overflow-x-auto border border-border/50 font-mono">
          <code className="text-foreground">{sql}</code>
        </pre>

        <div className="flex items-center gap-3">
          {!autoExecute && status !== "success" && (
            <Button onClick={handleExecute} size="sm" disabled={status === "running"} className="gap-2">
              <Play className="h-4 w-4" />
              {status === "running" ? "Executing..." : "Execute"}
            </Button>
          )}

          {status === "error" && (
            <div className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">{error}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
