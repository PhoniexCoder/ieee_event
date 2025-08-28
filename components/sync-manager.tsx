"use client"

import { useEffect, useState } from "react"
import { offlineStorage } from "@/lib/offline-storage"
import { useToast } from "@/hooks/use-toast"
import { Wifi, WifiOff, RefreshCw } from "lucide-react"

export function SyncManager() {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }

    const checkPendingSync = async () => {
      try {
        const unsynced = await offlineStorage.getUnsyncedAttendance()
        setPendingCount(unsynced.length)
      } catch (error) {
        console.error("Failed to check pending sync:", error)
      }
    }

    // Initial checks
    updateOnlineStatus()
    checkPendingSync()

    // Event listeners
    window.addEventListener("online", updateOnlineStatus)
    window.addEventListener("offline", updateOnlineStatus)

    // Auto-sync when coming online
    const handleOnline = async () => {
      updateOnlineStatus()
      if (navigator.onLine) {
        await syncPendingData()
      }
    }

    window.addEventListener("online", handleOnline)

    // Check for pending data periodically
    const interval = setInterval(checkPendingSync, 30000)

    return () => {
      window.removeEventListener("online", updateOnlineStatus)
      window.removeEventListener("offline", updateOnlineStatus)
      window.removeEventListener("online", handleOnline)
      clearInterval(interval)
    }
  }, [])

  const syncPendingData = async () => {
    if (!navigator.onLine || isSyncing) return

    setIsSyncing(true)
    try {
      const unsynced = await offlineStorage.getUnsyncedAttendance()

      for (const attendance of unsynced) {
        try {
          const response = await fetch("/api/attendance/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId: attendance.studentId,
              timestamp: attendance.timestamp,
              offline: true,
            }),
          })

          if (response.ok) {
            await offlineStorage.markAttendanceSynced(attendance.id)
          }
        } catch (error) {
          console.error("Failed to sync attendance:", error)
        }
      }

      const remainingUnsynced = await offlineStorage.getUnsyncedAttendance()
      setPendingCount(remainingUnsynced.length)

      if (unsynced.length > 0 && remainingUnsynced.length === 0) {
        toast({
          title: "Sync Complete",
          description: `Successfully synced ${unsynced.length} attendance records.`,
        })
      }
    } catch (error) {
      console.error("Sync failed:", error)
      toast({
        title: "Sync Failed",
        description: "Failed to sync offline data. Will retry automatically.",
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {isOnline ? (
        <div className="flex items-center gap-1 text-green-400">
          <Wifi className="h-4 w-4" />
          <span>Online</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-red-400">
          <WifiOff className="h-4 w-4" />
          <span>Offline</span>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="flex items-center gap-1 text-yellow-400">
          {isSyncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <span className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse" />
          )}
          <span>{pendingCount} pending</span>
        </div>
      )}
    </div>
  )
}
