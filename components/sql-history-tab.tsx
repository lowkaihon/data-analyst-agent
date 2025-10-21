"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SQLHistoryItem {
  sql: string
  timestamp: Date
  success: boolean
  executionTimeMs?: number
}

interface SQLHistoryTabProps {
  history: SQLHistoryItem[]
}

export function SQLHistoryTab({ history }: SQLHistoryTabProps) {
  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No SQL queries executed yet.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-3">
      {history.map((item, idx) => (
        <Card key={idx} className={item.success ? "" : "border-destructive"}>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Query {history.length - idx}</span>
              <span className="text-xs text-muted-foreground font-normal">{item.timestamp.toLocaleTimeString()}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
              <code>{item.sql}</code>
            </pre>
            <div className="flex items-center justify-between mt-2">
              {!item.success ? (
                <p className="text-sm text-destructive">Query failed</p>
              ) : (
                <p className="text-sm text-green-600">Success</p>
              )}
              {item.executionTimeMs !== undefined && (
                <p className="text-xs text-muted-foreground">Executed in {item.executionTimeMs}ms</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
