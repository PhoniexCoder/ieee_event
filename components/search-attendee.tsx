"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle } from "lucide-react"

interface SearchAttendeeProps {
  students: { name: string; email: string; rollNumber?: string; qrId?: string }[]
}

export function SearchAttendee({ students }: SearchAttendeeProps) {
  const [query, setQuery] = useState("")

  if (students.length === 0) {
    return <p className="text-sm text-muted-foreground">No students loaded. Sync students from the spreadsheet first.</p>
  }

  const filtered = query.trim()
    ? students.filter((s) =>
        [s.name, s.email, s.rollNumber].some((field) =>
          field?.toLowerCase().includes(query.toLowerCase())
        )
      )
    : []

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search by name, email, or roll number..."
        aria-label="Search attendees by name, email, or roll number"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() && (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches found.</p>
          ) : (
            filtered.slice(0, 50).map((s, i) => (
              <div key={`${s.email}-${i}`} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.email} {s.rollNumber ? `• ${s.rollNumber}` : ""}</p>
                </div>
                <Badge variant="outline" className="ml-2 shrink-0 text-xs">
                  {s.qrId ? <CheckCircle className="w-3 h-3 text-green-500 inline mr-1" /> : <XCircle className="w-3 h-3 text-red-500 inline mr-1" />}
                  {s.qrId ? "QR Ready" : "No QR"}
                </Badge>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
