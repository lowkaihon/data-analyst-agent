"use client"

import { ChartCard } from "./chart-card"
import type { ChartSpec } from "@/lib/schemas"

interface ChartsTabProps {
  charts: Array<{ spec: ChartSpec; title?: string; description?: string }>
}

export function ChartsTab({ charts }: ChartsTabProps) {
  if (charts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No charts generated yet. Ask the AI to create visualizations.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {charts.map((chart, idx) => (
        <ChartCard key={idx} spec={chart.spec} title={chart.title} description={chart.description} />
      ))}
    </div>
  )
}
