"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { UploadZone } from "@/components/upload-zone"
import { ChatInterface, type Message } from "@/components/chat-interface"
import { DataTabs } from "@/components/data-tabs"
import { getDB, loadCSV, executeQuery, getSchema } from "@/lib/duckdb"
import { validateSQL } from "@/lib/sql-guards"
import { getSample } from "@/lib/profiling"
import { createParsedView } from "@/lib/time-parsing"
import type { AsyncDuckDB } from "@duckdb/duckdb-wasm"
import type { SQLResult, ColumnInfo, ChartSpec, Plan } from "@/lib/schemas"
import { PanelGroup, Panel, PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface SQLHistoryItem {
  sql: string
  timestamp: Date
  success: boolean
  executionTimeMs?: number
}

interface ChartItem {
  spec: ChartSpec
  title?: string
  description?: string
}

export default function Home() {
  // State management
  const [db, setDb] = useState<AsyncDuckDB | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [dataDescription, setDataDescription] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [previewData, setPreviewData] = useState<SQLResult | null>(null)
  const [schema, setSchema] = useState<ColumnInfo[] | null>(null)
  const [rowCount, setRowCount] = useState<number>(0)
  const [sqlHistory, setSqlHistory] = useState<SQLHistoryItem[]>([])
  const [charts, setCharts] = useState<ChartItem[]>([])
  const [reportContent, setReportContent] = useState("")

  // Panel refs for collapse/expand functionality
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const rightPanelRef = useRef<ImperativePanelHandle>(null)

  // Initialize DuckDB on mount
  useEffect(() => {
    getDB()
      .then(setDb)
      .catch((err) => {
        console.error("[v0] Failed to initialize DuckDB:", err)
      })
  }, [])

  // Handle file upload
  const handleFileLoaded = useCallback(
    async (file: File) => {
      if (!db) {
        console.error("[v0] DuckDB not initialized")
        return
      }

      setIsLoading(true)
      setFileName(file.name)

      try {
        // Load CSV into DuckDB
        await loadCSV(db, file, "t_raw")

        // Create parsed view with date detection
        await createParsedView(db, "t_raw", "t_parsed")

        // Get schema and row count
        const schemaInfo = await getSchema(db, "t_parsed")
        setSchema(schemaInfo)

        const conn = await db.connect()
        const countResult = await conn.query("SELECT COUNT(*) as cnt FROM t_parsed")
        const count = Number(countResult.toArray()[0].cnt)
        setRowCount(count)
        await conn.close()

        // Get preview (first 100 rows)
        const preview = await executeQuery(db, "SELECT * FROM t_parsed", 30000, 100)
        setPreviewData(preview)

        // Add system message with optional data description
        const greetingParts = [
          `File "${file.name}" loaded successfully! ${count.toLocaleString()} rows, ${schemaInfo.length} columns.`,
        ]

        if (dataDescription) {
          greetingParts.push(`\nI understand this is ${dataDescription.toLowerCase()}.`)
        }

        greetingParts.push("\nWhat would you like to analyze?")

        setMessages([
          {
            id: Date.now().toString(),
            role: "assistant",
            content: greetingParts.join(""),
          },
        ])
      } catch (err) {
        console.error("[v0] Error loading file:", err)
        setMessages([
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `Error loading file: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [db],
  )

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!db || !schema) return

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: message,
      }
      setMessages((prev) => [...prev, userMessage])

      try {
        // Get sample for LLM context
        const sample = await getSample(db, "t_parsed", 5)

        // Call AI API
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: message,
            schema,
            sample,
            rowCount,
            dataDescription: dataDescription || undefined,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to get AI response")
        }

        const data = await response.json()
        const plan: Plan = data.plan

        // Add assistant message with plan using dynamic introduction
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: plan.introduction || "I've created an analysis plan for you. Please review and approve it to proceed.",
          plan,
          planStatus: "pending",
        }
        setMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        console.error("[v0] Error sending message:", err)
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Failed to process your question"}`,
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    },
    [db, schema, rowCount, dataDescription],
  )

  // Handle plan approval with sequential execution
  const handleApprovePlan = useCallback(
    async (messageId: string) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, planStatus: "approved" as const } : msg)),
      )

      // Find the approved plan
      const message = messages.find((m) => m.id === messageId)
      if (!message?.plan) return

      const totalSteps = message.plan.steps.length

      // Execute steps sequentially with delays for natural flow
      for (let i = 0; i < message.plan.steps.length; i++) {
        const step = message.plan.steps[i]
        const stepNumber = step.step

        // Add a small delay before each step for natural pacing
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 800))
        }

        // Show step header with "executing" state
        const stepHeaderMessage: Message = {
          id: `${Date.now()}-step-${stepNumber}`,
          role: "assistant",
          content: step.description,
          stepNumber,
          totalSteps,
          isExecuting: true,
        }
        setMessages((prev) => [...prev, stepHeaderMessage])

        // Small delay before showing SQL/chart
        await new Promise((resolve) => setTimeout(resolve, 400))

        // Mark step as complete and add SQL if present
        if (step.sql) {
          // Update step header to not executing
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === stepHeaderMessage.id ? { ...msg, isExecuting: false, sql: step.sql } : msg,
            ),
          )

          // Wait for SQL execution to complete (auto-executes via SQLCard)
          await new Promise((resolve) => setTimeout(resolve, 1200))
        }

        // Add chart if present
        if (step.chartSpec) {
          const chartMessage: Message = {
            id: `${Date.now()}-chart-${stepNumber}`,
            role: "assistant",
            content: `Visualization for step ${stepNumber}`,
            chart: step.chartSpec,
            stepNumber,
            totalSteps,
          }
          setMessages((prev) => [...prev, chartMessage])
          setCharts((prev) => [...prev, { spec: step.chartSpec!, title: step.description }])

          // Small delay after chart
          await new Promise((resolve) => setTimeout(resolve, 600))
        }

        // If step had no SQL, mark as complete
        if (!step.sql) {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === stepHeaderMessage.id ? { ...msg, isExecuting: false } : msg)),
          )
        }
      }

      // Add completion message with follow-up suggestions
      const completionMessage: Message = {
        id: `${Date.now()}-complete`,
        role: "assistant",
        content: `Analysis complete! All ${totalSteps} ${totalSteps === 1 ? "step has" : "steps have"} been executed successfully.

You might want to:
• Ask for specific insights about the results
• Request a different visualization or breakdown
• Drill down into interesting patterns you noticed
• Generate a summary report of this analysis

What would you like to explore next?`,
      }
      setMessages((prev) => [...prev, completionMessage])
    },
    [messages],
  )

  // Handle plan rejection
  const handleRejectPlan = useCallback((messageId: string) => {
    setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, planStatus: "rejected" as const } : msg)))

    const rejectMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: "Plan rejected. Please ask your question differently or provide more details.",
    }
    setMessages((prev) => [...prev, rejectMessage])
  }, [])

  // Handle SQL execution
  const handleExecuteSQL = useCallback(
    async (sql: string) => {
      if (!db) throw new Error("Database not initialized")

      try {
        // Validate SQL
        const validatedSQL = validateSQL(sql)

        // Execute query
        const result = await executeQuery(db, validatedSQL, 30000, 1000)

        // Update preview with results
        setPreviewData(result)

        // Add to history with execution time
        setSqlHistory((prev) => [
          ...prev,
          {
            sql: validatedSQL,
            timestamp: new Date(),
            success: true,
            executionTimeMs: result.executionTimeMs,
          },
        ])
      } catch (err) {
        // Add to history as failed
        setSqlHistory((prev) => [
          ...prev,
          {
            sql,
            timestamp: new Date(),
            success: false,
          },
        ])
        throw err
      }
    },
    [db],
  )

  // Handle report content change
  const handleReportChange = useCallback((content: string) => {
    setReportContent(content)
  }, [])

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Data Analyst Agent</h1>
        {fileName && <p className="text-sm text-muted-foreground mt-1">Analyzing: {fileName}</p>}
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {!fileName ? (
          <div className="h-full flex items-center justify-center p-8">
            <div className="w-full max-w-2xl space-y-6">
              <div className="space-y-2">
                <label htmlFor="data-description" className="text-sm font-medium">
                  Describe your data (optional)
                </label>
                <textarea
                  id="data-description"
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Provide context about your data (e.g., 'This is sales data from Q4 2024' or 'Customer demographics from our CRM system')"
                  value={dataDescription}
                  onChange={(e) => setDataDescription(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This information will help the AI better understand and analyze your data.
                </p>
              </div>
              <UploadZone onFileLoaded={handleFileLoaded} disabled={isLoading} />
            </div>
          </div>
        ) : (
          <PanelGroup direction="horizontal" autoSaveId="main-layout" className="h-full">
            {/* Left panel: Chat */}
            <Panel
              ref={leftPanelRef}
              defaultSize={50}
              minSize={20}
              maxSize={80}
              collapsible
              className="flex flex-col overflow-hidden"
            >
              <ChatInterface
                messages={messages}
                onSendMessage={handleSendMessage}
                onApprovePlan={handleApprovePlan}
                onRejectPlan={handleRejectPlan}
                onExecuteSQL={handleExecuteSQL}
                disabled={isLoading}
              />
            </Panel>

            {/* Resize handle with collapse/expand buttons */}
            <PanelResizeHandle className="relative group w-1.5 bg-border hover:bg-primary/50 transition-colors cursor-col-resize active:bg-primary">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    const panel = leftPanelRef.current
                    if (panel) {
                      if (panel.isCollapsed()) {
                        panel.expand()
                      } else {
                        panel.collapse()
                      }
                    }
                  }}
                  className="p-1 bg-background border rounded shadow-sm hover:bg-accent"
                  title="Toggle left panel"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    const panel = rightPanelRef.current
                    if (panel) {
                      if (panel.isCollapsed()) {
                        panel.expand()
                      } else {
                        panel.collapse()
                      }
                    }
                  }}
                  className="p-1 bg-background border rounded shadow-sm hover:bg-accent"
                  title="Toggle right panel"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </PanelResizeHandle>

            {/* Right panel: Data Tabs */}
            <Panel
              ref={rightPanelRef}
              defaultSize={50}
              minSize={20}
              maxSize={80}
              collapsible
              className="flex flex-col overflow-hidden"
            >
              <DataTabs
                previewData={previewData}
                schema={schema}
                rowCount={rowCount}
                sqlHistory={sqlHistory}
                charts={charts}
                reportContent={reportContent}
                onReportChange={handleReportChange}
              />
            </Panel>
          </PanelGroup>
        )}
      </div>
    </div>
  )
}
