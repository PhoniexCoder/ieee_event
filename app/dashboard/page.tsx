"use client"

import { useState, useCallback, useEffect } from "react"
import { VolunteerAccessCode } from "@/components/volunteer-access-code"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import dynamic from "next/dynamic"
const QRScannerComponent = dynamic(() => import("@/components/qr-scanner").then(mod => mod.QRScannerComponent), { ssr: false })
import { SyncManager } from "@/components/sync-manager"
import { DashboardSkeleton } from "@/components/loading-skeleton"
import { offlineStorage } from "@/lib/offline-storage"
import { useToast } from "@/hooks/use-toast"
import { Users, UserCheck, UserX, QrCode, LogOut, Clock, CheckCircle, AlertCircle, RefreshCw } from "lucide-react"

interface AttendanceStats {
  totalStudents: number
  presentStudents: number
  absentStudents: number
  attendanceRate: number
}

interface AttendanceLog {
  volunteerId: string
  volunteerName: string
  studentId: string
  studentName: string
  timestamp: string
  action: string
}


export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [accessGranted, setAccessGranted] = useState<boolean>(
    typeof window !== "undefined" && window.localStorage.getItem("volunteer_access_granted") === "true"
  );
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "error" | "duplicate">("idle")
  const [scanMessage, setScanMessage] = useState<string>("")
  const [stats, setStats] = useState<AttendanceStats>({
    totalStudents: 0,
    presentStudents: 0,
    absentStudents: 0,
    attendanceRate: 0,
  })
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  // Conditional rendering variables
  let content: React.ReactNode = null;

  if (
    status === "authenticated" &&
    session?.user?.role === "volunteer" &&
    !accessGranted
  ) {
    content = <VolunteerAccessCode onSuccess={() => setAccessGranted(true)} />;
  }

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/attendance/stats")
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }, [])

  const fetchRecentLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/attendance/logs?limit=5")
      if (response.ok) {
        const data = await response.json()
        setRecentLogs(data)
      }
    } catch (error) {
      console.error("[] Error fetching logs:", error)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") {
      const loadInitialData = async () => {
        setIsInitialLoading(true)
        await Promise.all([fetchStats(), fetchRecentLogs()])
        setIsInitialLoading(false)
      }
      loadInitialData()
    }
  }, [status, fetchStats, fetchRecentLogs])

  const handleQRScan = useCallback(
    async (qrData: string) => {
      console.log("[] Processing QR scan:", qrData)
      setIsLoading(true)

      try {
        if (!navigator.onLine) {
          const student = await offlineStorage.findStudent(qrData)
          if (student) {
            await offlineStorage.storeAttendance({
              studentId: qrData,
              studentName: student.name,
              timestamp: new Date().toISOString(),
            })

            setScanStatus("success")
            setScanMessage(`${student.name} marked present (offline)`)
            toast({
              title: "Attendance Marked (Offline)",
              description: `${student.name} will be synced when online.`,
            })
          } else {
            setScanStatus("error")
            setScanMessage("Student not found in offline database")
          }
        } else {
          const response = await fetch("/api/attendance/scan", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ qrId: qrData }),
          })

          const result = await response.json()

          if (result.success) {
            setScanStatus("success")
            setScanMessage(result.message)
            setScanResult(qrData)

            await fetchStats()
            await fetchRecentLogs()

            toast({
              title: "Attendance Marked",
              description: result.message,
            })
          } else {
            setScanStatus(result.student ? "duplicate" : "error")
            setScanMessage(result.message)
          }
        }
      } catch (error) {
        console.error("[] Error processing scan:", error)
        setScanStatus("error")
        setScanMessage("Failed to process scan")
        toast({
          title: "Scan Failed",
          description: "Please try again or check your connection.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)

        setTimeout(() => {
          setScanStatus("idle")
          setScanMessage("")
        }, 3000)
      }
    },
    [fetchStats, fetchRecentLogs, toast],
  )

  const handleScanError = useCallback((error: string) => {
    setScanStatus("error")
    setScanMessage(`Scanner error: ${error}`)
  }, [])

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const refreshData = async () => {
    setIsLoading(true)
    await Promise.all([fetchStats(), fetchRecentLogs()])
    setIsLoading(false)
  }

  if (!content) {
    if (status === "loading" || isInitialLoading) {
      content = (
        <div className="min-h-screen bg-background">
          <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">IEEE SB GEHU</h1>
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <div className="container mx-auto px-4 py-6">
            <DashboardSkeleton />
          </div>
        </div>
      );
    } else {
      content = (
        <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <QrCode className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">IEEE SB GEHU</h1>
                <p className="text-sm text-muted-foreground">Attendance Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SyncManager />
              <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{session?.user?.name}</p>
                <Badge variant="secondary" className="text-xs">
                  {session?.user?.role === "admin" ? "Admin" : "Volunteer"}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalStudents}</p>
                  <p className="text-xs text-muted-foreground">Total Students</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-500">{stats.presentStudents}</p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserX className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-500">{stats.absentStudents}</p>
                  <p className="text-xs text-muted-foreground">Absent</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-primary">{stats.attendanceRate}%</p>
                  <p className="text-xs text-muted-foreground">Attendance Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {scanStatus !== "idle" && (
          <Alert variant={scanStatus === "success" ? "default" : "destructive"}>
            <div className="flex items-center gap-2">
              {scanStatus === "success" && <CheckCircle className="w-4 h-4" />}
              {scanStatus === "error" && <AlertCircle className="w-4 h-4" />}
              {scanStatus === "duplicate" && <AlertCircle className="w-4 h-4" />}
              <AlertDescription>{scanMessage}</AlertDescription>
            </div>
          </Alert>
        )}


        {/* QR Scanner */}
        <div className="flex justify-center">
          <QRScannerComponent onScan={handleQRScan} onError={handleScanError} isScanning={true} />
        </div>

        {recentLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Latest attendance updates from all volunteers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentLogs.map((log, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium">{log.studentName || log.studentId}</p>
                        <p className="text-xs text-muted-foreground">
                          by {log.volunteerName} • {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Present
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How to Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Point your camera at a student's QR code</p>
            <p>2. The system will automatically scan and update Google Sheets</p>
            <p>3. Green confirmation means successful attendance marking</p>
            <p>4. Duplicate scans are automatically prevented</p>
            <p>5. All actions are logged for audit purposes</p>
            <p>6. Works offline - data syncs automatically when reconnected</p>
          </CardContent>
        </Card>
      </div>
    </div>
      );
    }
  }

  return content;
}
