"use client"

import { useState, useEffect } from "react"
import { AgenticExplorerBridge } from "@/components/agentic-explorer-bridge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { getDB, loadCSV } from "@/lib/duckdb"
import type { AsyncDuckDB } from "@duckdb/duckdb-wasm"

export default function TestBridgePage() {
  const [question, setQuestion] = useState("")
  const [started, setStarted] = useState(false)
  const [db, setDb] = useState<AsyncDuckDB | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  // Sample dataset schema
  const sampleSchema = [
    { name: "date", type: "DATE" },
    { name: "category", type: "VARCHAR" },
    { name: "sales", type: "DOUBLE" },
    { name: "quantity", type: "INTEGER" },
    { name: "region", type: "VARCHAR" },
  ]

  const sampleData = {
    columns: ["date", "category", "sales", "quantity", "region"],
    rows: [
      ["2024-01-01", "Electronics", 1250.5, 5, "North"],
      ["2024-01-02", "Clothing", 850.25, 12, "South"],
      ["2024-01-03", "Electronics", 2100.0, 8, "East"],
      ["2024-01-04", "Home", 650.75, 7, "West"],
      ["2024-01-05", "Clothing", 1450.0, 15, "North"],
    ],
  }

  // Initialize DuckDB with sample data
  const initializeDuckDB = async () => {
    setIsInitializing(true)
    setInitError(null)

    try {
      // Initialize DuckDB
      const database = await getDB()
      setDb(database)

      // Create sample data as CSV
      const csvContent = [
        "date,category,sales,quantity,region",
        "2024-01-01,Electronics,1250.5,5,North",
        "2024-01-02,Clothing,850.25,12,South",
        "2024-01-03,Electronics,2100.0,8,East",
        "2024-01-04,Home,650.75,7,West",
        "2024-01-05,Clothing,1450.0,15,North",
        "2024-01-06,Electronics,1800.0,6,South",
        "2024-01-07,Home,920.5,8,North",
        "2024-01-08,Clothing,1100.0,14,East",
      ].join("\n")

      // Create a File object from CSV content
      const blob = new Blob([csvContent], { type: "text/csv" })
      const file = new File([blob], "sample_sales.csv", { type: "text/csv" })

      // Load CSV into DuckDB
      await loadCSV(database, file, "t_raw")

      // Create parsed view (same as main app)
      const conn = await database.connect()
      try {
        await conn.query(`
          CREATE OR REPLACE TABLE t_parsed AS
          SELECT * FROM t_raw
        `)
        console.log("[Test Bridge] Sample data loaded successfully")
      } finally {
        await conn.close()
      }
    } catch (error) {
      console.error("[Test Bridge] Initialization error:", error)
      setInitError(error instanceof Error ? error.message : "Failed to initialize DuckDB")
    } finally {
      setIsInitializing(false)
    }
  }

  // Initialize on mount
  useEffect(() => {
    initializeDuckDB()
  }, [])

  const handleStart = () => {
    if (question.trim() && db) {
      setStarted(true)
    }
  }

  const handleReset = () => {
    setStarted(false)
    setQuestion("")
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Remote Tool Bridge Test</h1>
        <p className="text-muted-foreground">
          Test SQL execution bridge: Server-side AI calls tools, client-side DuckDB executes queries
        </p>
      </div>

      {!started ? (
        <Card>
          <CardHeader>
            <CardTitle>Configure Test</CardTitle>
            <CardDescription>
              Testing the remote tool bridge pattern with real DuckDB execution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Database Status</Label>
              <div className="p-4 bg-muted rounded-md">
                {isInitializing && (
                  <p className="text-sm">🔄 Initializing DuckDB with sample data...</p>
                )}
                {!isInitializing && db && (
                  <p className="text-sm text-green-600">✅ DuckDB initialized with sample sales data</p>
                )}
                {!isInitializing && initError && (
                  <p className="text-sm text-red-600">❌ Error: {initError}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sample Dataset</Label>
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm font-medium mb-2">Schema:</p>
                <ul className="text-xs space-y-1">
                  {sampleSchema.map((col) => (
                    <li key={col.name}>
                      <span className="font-mono">{col.name}</span>
                      <span className="text-muted-foreground"> ({col.type})</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm font-medium mt-4 mb-2">8 rows loaded</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="question">Your Question</Label>
              <Textarea
                id="question"
                placeholder="E.g., What are the sales trends by category?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                The AI will explore the data using SQL queries executed in your browser
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  🔒 Privacy-Preserving Architecture
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  SQL queries are executed locally in your browser. No raw data leaves your device.
                  The server only receives query results you approve.
                </p>
              </div>

              <Button
                onClick={handleStart}
                disabled={!question.trim() || !db || isInitializing}
                className="w-full"
                size="lg"
              >
                Start Agentic Exploration
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Exploring: "{question}"</CardTitle>
                  <CardDescription>
                    Watch the AI explore data with privacy-preserving tool execution
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </CardHeader>
          </Card>

          <AgenticExplorerBridge
            question={question}
            schema={sampleSchema}
            sample={sampleData}
            rowCount={8}
            dataDescription="Sample sales data from Q1 2024"
            db={db}
            onExplorationComplete={(summary) => {
              console.log("Exploration complete:", summary)
            }}
            onGenerateReport={() => {
              console.log("Generate report clicked")
              alert("Report generation coming soon!")
            }}
          />
        </div>
      )}
    </div>
  )
}
