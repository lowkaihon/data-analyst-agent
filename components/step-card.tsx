"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Loader2 } from "lucide-react"

interface StepCardProps {
  stepNumber: number
  totalSteps: number
  description: string
  isExecuting?: boolean
  isCompleted?: boolean
}

export function StepCard({ stepNumber, totalSteps, description, isExecuting, isCompleted }: StepCardProps) {
  return (
    <Card className={`border-l-4 ${isExecuting ? "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20" : isCompleted ? "border-l-green-500" : "border-l-gray-300"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Step {stepNumber} of {totalSteps}
          </CardTitle>
          {isExecuting && (
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs font-medium">Executing...</span>
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Completed</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{description}</p>
      </CardContent>
    </Card>
  )
}
