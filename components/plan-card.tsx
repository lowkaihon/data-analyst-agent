"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle } from "lucide-react"
import type { Plan } from "@/lib/schemas"

interface PlanCardProps {
  plan: Plan
  onApprove: () => void
  onReject: () => void
  status: "pending" | "approved" | "rejected"
}

export function PlanCard({ plan, onApprove, onReject, status }: PlanCardProps) {
  return (
    <Card className={`border-l-4 ${status === "approved" ? "border-l-green-500 bg-green-50/30 dark:bg-green-950/10" : status === "rejected" ? "border-l-red-500 bg-red-50/30 dark:bg-red-950/10" : "border-l-primary bg-primary/5"}`}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Analysis Plan</CardTitle>
        <CardDescription className="text-sm leading-relaxed">{plan.reasoning}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 bg-muted/30 p-4 rounded-md border border-border/50">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {plan.steps.length} Step{plan.steps.length !== 1 ? "s" : ""} to Execute
          </div>
          {plan.steps.map((step) => (
            <div key={step.step} className="flex gap-3 text-sm items-start">
              <span className="font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded text-xs min-w-[24px] text-center">
                {step.step}
              </span>
              <span className="flex-1 leading-relaxed">{step.description}</span>
            </div>
          ))}
        </div>

        {status === "pending" && (
          <div className="flex gap-2 pt-2">
            <Button onClick={onApprove} size="sm" className="gap-2 flex-1 sm:flex-none">
              <CheckCircle className="h-4 w-4" />
              Approve Plan
            </Button>
            <Button onClick={onReject} size="sm" variant="outline" className="gap-2 flex-1 sm:flex-none">
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </div>
        )}

        {status === "approved" && (
          <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2 font-medium bg-green-100/50 dark:bg-green-900/20 p-3 rounded-md">
            <CheckCircle className="h-4 w-4" />
            Plan approved - Executing steps...
          </div>
        )}

        {status === "rejected" && (
          <div className="text-sm text-destructive flex items-center gap-2 font-medium bg-red-100/50 dark:bg-red-900/20 p-3 rounded-md">
            <XCircle className="h-4 w-4" />
            Plan rejected
          </div>
        )}
      </CardContent>
    </Card>
  )
}
