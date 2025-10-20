"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, CheckCircle, AlertCircle } from "lucide-react"
import { useState } from "react"

interface SQLCardProps {
  sql: string
  onExecute: (sql: string) => Promise<void>
  stepNumber?: number
}

export function SQLCard({ sql, onExecute, stepNumber }: SQLCardProps) {
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle")
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

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <CardTitle className="text-base">SQL Query {stepNumber !== undefined && `(Step ${stepNumber})`}</CardTitle>
        <CardDescription>Click execute to run this query</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
          <code>{sql}</code>
        </pre>

        <div className="flex items-center gap-2">
          <Button onClick={handleExecute} size="sm" disabled={status === "running"} className="gap-2">
            <Play className="h-4 w-4" />
            {status === "running" ? "Executing..." : "Execute"}
          </Button>

          {status === "success" && (
            <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Query executed
            </div>
          )}

          {status === "error" && (
            <div className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
