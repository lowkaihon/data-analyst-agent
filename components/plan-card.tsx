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
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle className="text-base">Analysis Plan</CardTitle>
        <CardDescription>{plan.reasoning}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {plan.steps.map((step) => (
            <div key={step.step} className="flex gap-3 text-sm">
              <span className="font-semibold text-muted-foreground">{step.step}.</span>
              <span>{step.description}</span>
            </div>
          ))}
        </div>

        {status === "pending" && (
          <div className="flex gap-2 pt-2">
            <Button onClick={onApprove} size="sm" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Approve
            </Button>
            <Button onClick={onReject} size="sm" variant="outline" className="gap-2 bg-transparent">
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </div>
        )}

        {status === "approved" && (
          <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Plan approved
          </div>
        )}

        {status === "rejected" && (
          <div className="text-sm text-destructive flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Plan rejected
          </div>
        )}
      </CardContent>
    </Card>
  )
}
