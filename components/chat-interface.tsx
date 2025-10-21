"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Send, User, Bot } from "lucide-react"
import { PlanCard } from "./plan-card"
import { SQLCard } from "./sql-card"
import { ChartCard } from "./chart-card"
import { StepCard } from "./step-card"
import type { Plan, ChartSpec } from "@/lib/schemas"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  plan?: Plan
  planStatus?: "pending" | "approved" | "rejected"
  sql?: string
  chart?: ChartSpec
  stepNumber?: number
  totalSteps?: number
  isExecuting?: boolean
}

interface ChatInterfaceProps {
  messages: Message[]
  onSendMessage: (message: string) => void
  onApprovePlan: (messageId: string) => void
  onRejectPlan: (messageId: string) => void
  onExecuteSQL: (sql: string) => Promise<void>
  disabled?: boolean
}

export function ChatInterface({
  messages,
  onSendMessage,
  onApprovePlan,
  onRejectPlan,
  onExecuteSQL,
  disabled,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !disabled) {
      onSendMessage(input.trim())
      setInput("")
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Upload a CSV file to start analyzing your data</p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="flex gap-3">
            <div className="flex-shrink-0">
              {message.role === "user" ? (
                <div className="rounded-full bg-primary p-2">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              ) : (
                <div className="rounded-full bg-muted p-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              {message.content && !message.stepNumber && (
                <Card className="p-3">
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </Card>
              )}

              {message.plan && message.planStatus && (
                <PlanCard
                  plan={message.plan}
                  status={message.planStatus}
                  onApprove={() => onApprovePlan(message.id)}
                  onReject={() => onRejectPlan(message.id)}
                />
              )}

              {message.stepNumber && message.totalSteps && message.content && (
                <StepCard
                  stepNumber={message.stepNumber}
                  totalSteps={message.totalSteps}
                  description={message.content}
                  isExecuting={message.isExecuting}
                  isCompleted={!message.isExecuting && (message.sql !== undefined || message.chart !== undefined)}
                />
              )}

              {message.sql && <SQLCard sql={message.sql} onExecute={onExecuteSQL} stepNumber={message.stepNumber} autoExecute />}

              {message.chart && <ChartCard spec={message.chart} title={message.content} />}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your data..."
            disabled={disabled}
            className="flex-1"
          />
          <Button type="submit" disabled={disabled || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
