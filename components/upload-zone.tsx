"use client"

import type React from "react"

import { useCallback, useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface UploadZoneProps {
  onFileLoaded: (file: File) => void
  disabled?: boolean
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_COLUMNS = 200

export function UploadZone({ onFileLoaded, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!file.name.endsWith(".csv")) {
      return "Only CSV files are supported"
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`
    }

    return null
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      // Quick column count check by reading first line
      try {
        const text = await file.slice(0, 10000).text()
        const firstLine = text.split("\n")[0]
        const columnCount = firstLine.split(",").length

        if (columnCount > MAX_COLUMNS) {
          setError(`CSV has ${columnCount} columns. Maximum ${MAX_COLUMNS} columns allowed.`)
          return
        }
      } catch (err) {
        setError("Failed to read CSV file")
        return
      }

      onFileLoaded(file)
    },
    [validateFile, onFileLoaded],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      if (disabled) return

      const file = e.dataTransfer.files[0]
      if (file) {
        handleFile(file)
      }
    },
    [disabled, handleFile],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile],
  )

  return (
    <Card
      className={`border-2 border-dashed p-8 text-center transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full bg-muted p-4">
          <Upload className="h-8 w-8 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Upload CSV File</h3>
          <p className="text-sm text-muted-foreground">Drag and drop your CSV file here, or click to browse</p>
          <p className="text-xs text-muted-foreground">Maximum file size: 20MB, Maximum columns: 200</p>
        </div>

        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button variant="outline" disabled={disabled} asChild>
            <label className="cursor-pointer">
              Choose File
              <input type="file" accept=".csv" className="hidden" onChange={handleFileInput} disabled={disabled} />
            </label>
          </Button>

          {error && <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">{error}</div>}
        </div>
      </div>
    </Card>
  )
}
