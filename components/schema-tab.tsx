"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ColumnInfo } from "@/lib/schemas"

interface SchemaTabProps {
  schema: ColumnInfo[] | null
  rowCount?: number
}

export function SchemaTab({ schema, rowCount }: SchemaTabProps) {
  if (!schema || schema.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No schema information available.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Dataset Information</CardTitle>
          <CardDescription>
            {schema.length} columns {rowCount !== undefined && `• ${rowCount.toLocaleString()} rows`}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-2">
        {schema.map((col) => (
          <Card key={col.name}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{col.name}</p>
                  <p className="text-sm text-muted-foreground">{col.type}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
