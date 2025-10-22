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
import { Button } from "@/components/ui/button"

interface SQLHistoryItem {
  sql: string
  timestamp: Date
  success: boolean
  executionTimeMs?: number
  result?: {
    columns: string[]
    rows: unknown[][]
  }
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [dataDescription, setDataDescription] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [previewData, setPreviewData] = useState<SQLResult | null>(null)
  const [schema, setSchema] = useState<ColumnInfo[] | null>(null)
  const [rowCount, setRowCount] = useState<number>(0)
  const [sqlHistory, setSqlHistory] = useState<SQLHistoryItem[]>([])
  const [charts, setCharts] = useState<ChartItem[]>([])
  const [reportContent, setReportContent] = useState("")
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [activeTab, setActiveTab] = useState("preview")

  // Panel refs for collapse/expand functionality
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const rightPanelRef = useRef<ImperativePanelHandle>(null)

  // Ref to track latest SQL history for async operations
  const sqlHistoryRef = useRef<SQLHistoryItem[]>([])

  // Keep ref in sync with state
  useEffect(() => {
    sqlHistoryRef.current = sqlHistory
  }, [sqlHistory])

  // Initialize DuckDB on mount
  useEffect(() => {
    getDB()
      .then(setDb)
      .catch((err) => {
        console.error("[v0] Failed to initialize DuckDB:", err)
      })
  }, [])

  // Handle file selection (first step)
  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file)
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

        // Generate AI greeting message
        let greetingContent = `File "${file.name}" loaded successfully! ${count.toLocaleString()} rows, ${schemaInfo.length} columns. What would you like to analyze?`

        try {
          const greetingResponse = await fetch("/api/chat-response", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messageType: "greeting",
              context: {
                fileName: file.name,
                rowCount: count,
                schema: schemaInfo,
                dataDescription: dataDescription || undefined,
              },
            }),
          })

          if (greetingResponse.ok) {
            const greetingData = await greetingResponse.json()
            greetingContent = greetingData.message
          }
        } catch (error) {
          console.error("[v0] Failed to generate AI greeting, using fallback:", error)
        }

        // Add system message with AI-generated or fallback content
        setMessages([
          {
            id: Date.now().toString(),
            role: "assistant",
            content: greetingContent,
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
    [db, dataDescription],
  )

  // Handle proceeding with analysis (second step)
  const handleProceedWithFile = useCallback(() => {
    if (selectedFile) {
      handleFileLoaded(selectedFile)
    }
  }, [selectedFile, handleFileLoaded])

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
        // Step 1: Classify intent (chat vs analysis)
        const conversationHistory = messages.slice(-6).map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))

        const intentResponse = await fetch("/api/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            conversationHistory,
            dataContext: {
              schemaColumns: schema.map((col) => col.name),
              dataDescription: dataDescription || undefined,
            },
          }),
        })

        const intentData = await intentResponse.json()
        const intent = intentData.intent || "analysis" // Default to analysis if classification fails

        console.log(`[intent] Classified as: ${intent} - ${intentData.reasoning}`)

        // Step 2: Route based on intent
        if (intent === "chat") {
          // Handle conversational message
          const chatResponse = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message,
              conversationHistory,
              dataContext: {
                fileName,
                rowCount,
                columnCount: schema.length,
                schemaColumns: schema.map((col) => col.name),
                dataDescription: dataDescription || undefined,
              },
            }),
          })

          if (!chatResponse.ok) {
            throw new Error("Failed to get chat response")
          }

          const chatData = await chatResponse.json()

          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: chatData.message,
          }
          setMessages((prev) => [...prev, assistantMessage])
        } else {
          // Handle analysis request
          const sample = await getSample(db, "t_parsed", 5)

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

          // Generate AI plan introduction
          let planIntroContent = "I've created an analysis plan for you. Please review and approve it to proceed."

          try {
            const introResponse = await fetch("/api/chat-response", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messageType: "plan_intro",
                context: {
                  userQuestion: message,
                  plan: plan,
                },
              }),
            })

            if (introResponse.ok) {
              const introData = await introResponse.json()
              planIntroContent = introData.message
            }
          } catch (error) {
            console.error("[v0] Failed to generate AI plan intro, using fallback:", error)
          }

          // Add assistant message with plan and AI-generated introduction
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: planIntroContent,
            plan,
            planStatus: "pending",
          }
          setMessages((prev) => [...prev, assistantMessage])
        }
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
    [db, schema, rowCount, dataDescription, messages, fileName],
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

      // Track executed steps and charts for completion message
      const executedSteps: string[] = []
      const chartTypes: string[] = []

      // Find original user question
      const userMessages = messages.filter((m) => m.role === "user")
      const originalQuestion = userMessages[userMessages.length - 1]?.content || "your analysis"

      // Execute steps sequentially with delays for natural flow
      for (let i = 0; i < message.plan.steps.length; i++) {
        const step = message.plan.steps[i]
        const stepNumber = step.step

        // Track this step
        executedSteps.push(step.description)

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
        let sqlResult: SQLHistoryItem | undefined
        if (step.sql) {
          // Track current SQL history length before execution
          const expectedHistoryLength = sqlHistoryRef.current.length + 1

          // Update step header to not executing
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === stepHeaderMessage.id ? { ...msg, isExecuting: false, sql: step.sql } : msg,
            ),
          )

          // Wait for SQL execution to complete (auto-executes via SQLCard)
          // Poll sqlHistoryRef until it updates with the new result
          const maxWaitTime = 5000 // 5 seconds max
          const pollInterval = 100 // Check every 100ms
          let waited = 0

          while (waited < maxWaitTime) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval))
            waited += pollInterval

            // Check if SQL has executed and been added to history (use ref for latest value)
            if (sqlHistoryRef.current.length >= expectedHistoryLength) {
              sqlResult = sqlHistoryRef.current[expectedHistoryLength - 1]
              break
            }
          }

          // If we didn't get a result, log a warning but continue
          if (!sqlResult) {
            console.warn("[v0] SQL execution timed out or failed, chart may not have data")
          }
        }

        // Add chart if present
        if (step.chartSpec) {
          // Track chart type
          const chartType = step.chartSpec.mark?.type || step.chartSpec.mark || "chart"
          chartTypes.push(typeof chartType === "string" ? chartType : "visualization")

          // Inject actual SQL results into chart spec if available
          let enrichedChartSpec = step.chartSpec

          if (step.sql && sqlResult?.success && sqlResult.result) {
            // Convert SQL result to Vega-Lite data format
            const chartData = sqlResult.result.rows.map((row) => {
              const dataPoint: Record<string, unknown> = {}
              sqlResult.result!.columns.forEach((col, idx) => {
                dataPoint[col] = row[idx]
              })
              return dataPoint
            })

            // Inject data into chart spec
            enrichedChartSpec = {
              ...step.chartSpec,
              data: { values: chartData },
            }
          } else if (step.sql) {
            // SQL was supposed to run but failed or timed out
            console.error("[v0] Cannot create chart - SQL execution failed or no result available")
            // Still create chart but it will fail to render without data
          }

          const chartMessage: Message = {
            id: `${Date.now()}-chart-${stepNumber}`,
            role: "assistant",
            content: `Visualization for step ${stepNumber}`,
            chart: enrichedChartSpec,
            stepNumber,
            totalSteps,
          }
          setMessages((prev) => [...prev, chartMessage])
          setCharts((prev) => [...prev, { spec: enrichedChartSpec, title: step.description }])

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

      // Generate AI completion message with suggestions
      let completionContent = `Analysis complete! All ${totalSteps} steps have been executed successfully. You can view the results in the Preview and Charts tabs.`

      try {
        const completionResponse = await fetch("/api/chat-response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageType: "completion",
            context: {
              executedSteps,
              chartTypes,
              originalQuestion,
            },
          }),
        })

        if (completionResponse.ok) {
          const completionData = await completionResponse.json()
          completionContent = completionData.message
        }
      } catch (error) {
        console.error("[v0] Failed to generate AI completion message, using fallback:", error)
      }

      // Add completion message
      const completionMessage: Message = {
        id: `${Date.now()}-complete`,
        role: "assistant",
        content: completionContent,
      }
      setMessages((prev) => [...prev, completionMessage])
    },
    [messages],
  )

  // Handle plan rejection
  const handleRejectPlan = useCallback(
    async (messageId: string) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, planStatus: "rejected" as const } : msg)),
      )

      // Find the rejected plan for context
      const rejectedMessage = messages.find((m) => m.id === messageId)
      const rejectedPlan = rejectedMessage?.plan

      // Generate AI rejection message
      let rejectContent = "Plan rejected. Please ask your question differently or provide more details."

      try {
        const rejectResponse = await fetch("/api/chat-response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageType: "rejection",
            context: {
              rejectedPlan,
            },
          }),
        })

        if (rejectResponse.ok) {
          const rejectData = await rejectResponse.json()
          rejectContent = rejectData.message
        }
      } catch (error) {
        console.error("[v0] Failed to generate AI rejection message, using fallback:", error)
      }

      const rejectMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: rejectContent,
      }
      setMessages((prev) => [...prev, rejectMessage])
    },
    [messages],
  )

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

        // Add to history with execution time and results
        setSqlHistory((prev) => [
          ...prev,
          {
            sql: validatedSQL,
            timestamp: new Date(),
            success: true,
            executionTimeMs: result.executionTimeMs,
            result: {
              columns: result.columns,
              rows: result.rows,
            },
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

  // Handle report generation
  const handleGenerateReport = useCallback(async () => {
    if (!schema) return

    setIsGeneratingReport(true)
    try {
      // Get the original question from the first user message
      const firstUserMessage = messages.find((m) => m.role === "user")
      const question = firstUserMessage?.content || "Data analysis"

      // Call the report API
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          schema,
          sqlHistory: sqlHistory
            .filter((h) => h.success && h.result)
            .map((h) => ({
              sql: h.sql,
              result: h.result,
            })),
          charts: charts.map((c) => c.spec),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate report")
      }

      const data = await response.json()
      setReportContent(data.report)

      // Switch to report tab
      setActiveTab("report")
    } catch (err) {
      console.error("[v0] Error generating report:", err)
      // Optionally add an error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Error generating report: ${err instanceof Error ? err.message : "Unknown error"}`,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsGeneratingReport(false)
    }
  }, [schema, messages, sqlHistory, charts])

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
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  This information will help the AI better understand and analyze your data.
                </p>
              </div>
              <UploadZone
                onFileLoaded={handleFileLoaded}
                onFileSelected={handleFileSelected}
                selectedFile={selectedFile}
                disabled={isLoading}
              />
              {selectedFile && (
                <Button onClick={handleProceedWithFile} disabled={isLoading} size="lg" className="w-full">
                  {isLoading ? "Loading data..." : "Proceed to Analysis"}
                </Button>
              )}
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
                onGenerateReport={handleGenerateReport}
                isGeneratingReport={isGeneratingReport}
                isDataLoaded={!!fileName}
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
                onGenerateReport={handleGenerateReport}
                isGeneratingReport={isGeneratingReport}
                isDataLoaded={!!fileName}
                activeTab={activeTab}
                onActiveTabChange={setActiveTab}
              />
            </Panel>
          </PanelGroup>
        )}
      </div>
    </div>
  )
}
