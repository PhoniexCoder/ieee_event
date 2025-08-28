"use client"

import { useState } from "react"

export function VolunteerAccessCode({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // The code is injected at build time for security
    const accessCode = process.env.NEXT_PUBLIC_VOLUNTEER_ACCESS_CODE
    if (code === accessCode) {
      window.localStorage.setItem("volunteer_access_granted", "true")
      setError("")
      onSuccess()
    } else {
      setError("Invalid code. Please try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 mt-10">
      <label className="text-lg font-semibold">Enter Volunteer Access Code</label>
      <input
        type="password"
        value={code}
        onChange={e => setCode(e.target.value)}
        className="border rounded px-3 py-2 text-lg"
        placeholder="Access Code"
        required
      />
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Submit</button>
      {error && <div className="text-red-600">{error}</div>}
    </form>
  )
}
