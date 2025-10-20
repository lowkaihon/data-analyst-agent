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
      embed(containerRef.current, spec, {
        actions: false,
        renderer: "svg",
      }).catch((err) => {
        console.error("[v0] Vega-Lite rendering error:", err)
      })
    }
  }, [spec])

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader>
        <CardTitle className="text-base">{title || "Visualization"}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="w-full" />
      </CardContent>
    </Card>
  )
}
