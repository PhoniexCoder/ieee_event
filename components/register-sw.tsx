"use client"

import { useEffect } from "react"

export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        console.warn("Service worker registration failed")
      })
    }
  }, [])

  return null
}
