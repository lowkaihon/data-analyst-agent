"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PreviewTab } from "./preview-tab"
import { SchemaTab } from "./schema-tab"
import { SQLHistoryTab } from "./sql-history-tab"
import { ChartsTab } from "./charts-tab"
import { ReportTab } from "./report-tab"
import type { SQLResult, ColumnInfo, ChartSpec } from "@/lib/schemas"

interface SQLHistoryItem {
  sql: string
  timestamp: Date
  success: boolean
}

interface DataTabsProps {
  previewData: SQLResult | null
  schema: ColumnInfo[] | null
  rowCount?: number
  sqlHistory: SQLHistoryItem[]
  charts: Array<{ spec: ChartSpec; title?: string; description?: string }>
  reportContent: string
  onReportChange: (content: string) => void
  onGenerateReport?: () => void
  isGeneratingReport?: boolean
  isDataLoaded?: boolean
  activeTab?: string
  onActiveTabChange?: (tab: string) => void
}

export function DataTabs({
  previewData,
  schema,
  rowCount,
  sqlHistory,
  charts,
  reportContent,
  onReportChange,
  onGenerateReport,
  isGeneratingReport,
  isDataLoaded,
  activeTab,
  onActiveTabChange,
}: DataTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={onActiveTabChange}
      defaultValue="preview"
      className="h-full flex flex-col"
    >
      <TabsList className="w-full justify-start rounded-none border-b">
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="schema">Schema</TabsTrigger>
        <TabsTrigger value="sql">SQL</TabsTrigger>
        <TabsTrigger value="charts">Charts</TabsTrigger>
        <TabsTrigger value="report">Report</TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-hidden">
        <TabsContent value="preview" className="h-full m-0">
          <PreviewTab data={previewData} />
        </TabsContent>

        <TabsContent value="schema" className="h-full m-0">
          <SchemaTab schema={schema} rowCount={rowCount} />
        </TabsContent>

        <TabsContent value="sql" className="h-full m-0">
          <SQLHistoryTab history={sqlHistory} />
        </TabsContent>

        <TabsContent value="charts" className="h-full m-0">
          <ChartsTab charts={charts} />
        </TabsContent>

        <TabsContent value="report" className="h-full m-0">
          <ReportTab
            initialContent={reportContent}
            onContentChange={onReportChange}
            onGenerateReport={onGenerateReport}
            isGeneratingReport={isGeneratingReport}
            isDataLoaded={isDataLoaded}
          />
        </TabsContent>
      </div>
    </Tabs>
  )
}
