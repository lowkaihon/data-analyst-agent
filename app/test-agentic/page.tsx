"use client"

import { useState, useEffect } from "react"
import { AgenticExplorer } from "@/components/agentic-explorer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function TestAgenticPage() {
  const [question, setQuestion] = useState("")
  const [started, setStarted] = useState(false)

  // Sample dataset for testing
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

  const handleStart = () => {
    if (question.trim()) {
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
        <h1 className="text-3xl font-bold mb-2">Agentic Explorer Test</h1>
        <p className="text-muted-foreground">
          Test the streaming agentic exploration with SQL tool calling
        </p>
      </div>

      {!started ? (
        <Card>
          <CardHeader>
            <CardTitle>Configure Test</CardTitle>
            <CardDescription>
              This test uses sample sales data. The AI will use the SQL execution tool to explore and
              analyze the data in real-time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                <p className="text-sm font-medium mt-4 mb-2">Sample Rows: 5 rows</p>
                <p className="text-xs text-muted-foreground">
                  Contains sales data with dates, categories, amounts, quantities, and regions
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="question">Your Question</Label>
              <Textarea
                id="question"
                placeholder="E.g., What are the sales trends? Which category performs best?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                The AI will autonomously explore the data using SQL queries to answer your question
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  ⚠️ Important: DuckDB Setup Required
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  This test requires DuckDB to be initialized with the sample data in the table
                  "t_parsed". Currently, the test will call the API but the SQL tool execution will
                  fail without actual database setup.
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-200 mt-2">
                  <strong>What you'll see:</strong> Real-time streaming of the AI's thinking and tool
                  calls, even without data.
                </p>
              </div>

              <Button onClick={handleStart} disabled={!question.trim()} className="w-full" size="lg">
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
                  <CardDescription>Watch the AI explore data in real-time with tools</CardDescription>
                </div>
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </CardHeader>
          </Card>

          <AgenticExplorer
            question={question}
            schema={sampleSchema}
            sample={sampleData}
            rowCount={100}
            dataDescription="Sample sales data from Q1 2024"
            onExplorationComplete={(summary) => {
              console.log("Exploration complete:", summary)
            }}
            onGenerateReport={() => {
              console.log("Generate report clicked")
              alert("Report generation coming in Phase 1 Step 1.6!")
            }}
          />
        </div>
      )}
    </div>
  )
}
