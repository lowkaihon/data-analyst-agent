/**
 * Loading skeleton components for better UX during data loading
 */

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

/**
 * Table loading skeleton
 */
export function TableSkeleton({ rows = 10, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="space-y-2">
        {/* Header row */}
        <div className="flex gap-2">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={`header-${i}`} className="h-10 flex-1" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex gap-2">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-8 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Chat message loading skeleton
 */
export function ChatMessageSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

/**
 * Schema loading skeleton
 */
export function SchemaSkeleton({ columns = 8 }: { columns?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: columns }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * Chart loading skeleton
 */
export function ChartSkeleton() {
  return (
    <div className="p-4 flex items-center justify-center h-64">
      <div className="w-full h-full bg-muted rounded-lg animate-pulse flex items-center justify-center">
        <div className="text-muted-foreground">Loading chart...</div>
      </div>
    </div>
  )
}

/**
 * SQL History loading skeleton
 */
export function SQLHistorySkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * File upload loading skeleton
 */
export function FileUploadSkeleton() {
  return (
    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12">
      <div className="flex flex-col items-center justify-center space-y-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}
