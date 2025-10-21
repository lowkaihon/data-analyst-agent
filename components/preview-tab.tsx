"use client"

import { useState } from "react"
import type { SQLResult } from "@/lib/schemas"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { TableSkeleton } from "@/components/loading-skeletons"

interface PreviewTabProps {
  data: SQLResult | null
  isLoading?: boolean
}

export function PreviewTab({ data, isLoading = false }: PreviewTabProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(50)

  if (isLoading) {
    return <TableSkeleton rows={10} columns={5} />
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No data to preview. Upload a CSV file to get started.</p>
      </div>
    )
  }

  const totalRows = data.rows.length
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  const startRow = (currentPage - 1) * rowsPerPage
  const endRow = Math.min(startRow + rowsPerPage, totalRows)
  const paginatedRows = data.rows.slice(startRow, endRow)

  const goToFirstPage = () => setCurrentPage(1)
  const goToPreviousPage = () => setCurrentPage((prev) => Math.max(1, prev - 1))
  const goToNextPage = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1))
  const goToLastPage = () => setCurrentPage(totalPages)

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
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
            {paginatedRows.map((row, rowIdx) => (
              <tr key={startRow + rowIdx} className="hover:bg-muted/50">
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

      {/* Pagination Controls */}
      <div className="border-t bg-background px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Showing {startRow + 1} to {endRow} of {totalRows} rows
          </span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="ml-2 border rounded px-2 py-1 text-sm"
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={250}>250 per page</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={goToFirstPage}
            disabled={currentPage === 1}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-3">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToLastPage}
            disabled={currentPage === totalPages}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
