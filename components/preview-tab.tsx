"use client"

import type { SQLResult } from "@/lib/schemas"

interface PreviewTabProps {
  data: SQLResult | null
}

export function PreviewTab({ data }: PreviewTabProps) {
  if (!data || data.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No data to preview. Upload a CSV file to get started.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-background border-b-2 border-border z-10">
          <tr>
            {data.columns.map((col) => (
              <th
                key={col}
                className="border border-border px-3 py-2 text-left font-semibold whitespace-nowrap bg-muted"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-muted/50">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="border border-border px-3 py-2 whitespace-nowrap">
                  {cell === null ? <span className="text-muted-foreground italic">null</span> : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
