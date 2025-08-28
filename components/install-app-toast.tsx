"use client"

import { useEffect } from "react"
import { useToast } from "@/hooks/use-toast"

export function InstallAppToast() {
  const { toast } = useToast()

  useEffect(() => {
    let deferredPrompt: any = null
    const handler = (e: any) => {
      e.preventDefault()
      deferredPrompt = e
      toast({
        title: "Install App",
        description: "Add this app to your home screen for a better experience.",
        action: {
          label: "Install",
          onClick: () => {
            if (deferredPrompt) {
              deferredPrompt.prompt()
              deferredPrompt.userChoice.then(() => {
                deferredPrompt = null
              })
            }
          },
        },
      })
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [toast])

  return null
}
