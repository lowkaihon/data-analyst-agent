"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Download } from "lucide-react"

interface ReportTabProps {
  initialContent?: string
  onContentChange?: (content: string) => void
}

export function ReportTab({ initialContent = "", onContentChange }: ReportTabProps) {
  const [content, setContent] = useState(initialContent)

  const handleChange = (value: string) => {
    setContent(value)
    onContentChange?.(value)
  }

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `analysis-report-${new Date().toISOString().split("T")[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Analysis Report</h3>
        <Button
          onClick={handleDownload}
          size="sm"
          variant="outline"
          className="gap-2 bg-transparent"
          disabled={!content.trim()}
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>

      <Textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Generate a report using the AI, or write your own analysis here..."
        className="flex-1 font-mono text-sm resize-none"
      />

      {content && (
        <div className="text-xs text-muted-foreground">
          {content.split("\n").length} lines • {content.length} characters
        </div>
      )}
    </div>
  )
}
