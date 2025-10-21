"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useRef } from "react"
import type { ChartSpec } from "@/lib/schemas"
import embed from "vega-embed"

interface ChartCardProps {
  spec: ChartSpec
  title?: string
  description?: string
}

export function ChartCard({ spec, title, description }: ChartCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      // Clear previous chart
      containerRef.current.innerHTML = ""

      // Enhanced Vega-Lite configuration with better defaults
      const enhancedSpec = {
        ...spec,
        background: "transparent",
        config: {
          view: { stroke: "transparent" },
          axis: {
            labelFontSize: 11,
            titleFontSize: 13,
            titleColor: "#334155",
            labelColor: "#64748b",
            gridColor: "#e2e8f0",
            domainColor: "#cbd5e1",
          },
          legend: {
            labelFontSize: 11,
            titleFontSize: 12,
            titleColor: "#334155",
            labelColor: "#64748b",
          },
          ...spec.config,
        },
      }

      embed(containerRef.current, enhancedSpec, {
        actions: {
          export: true,
          source: false,
          compiled: false,
          editor: false,
        },
        renderer: "svg",
        theme: "latimes",
      }).catch((err) => {
        console.error("[v0] Vega-Lite rendering error:", err)
      })
    }
  }, [spec])

  return (
    <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20">
      <CardHeader>
        <CardTitle className="text-base">{title || "Visualization"}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="w-full flex items-center justify-center min-h-[300px]" />
      </CardContent>
    </Card>
  )
}
