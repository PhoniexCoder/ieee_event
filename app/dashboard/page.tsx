"use client"

import { useState, useCallback, useEffect } from "react"
import { VolunteerAccessCode } from "@/components/volunteer-access-code"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import dynamic from "next/dynamic"
const QRScannerComponent = dynamic(() => import("@/components/qr-scanner").then(mod => mod.QRScannerComponent), { ssr: false })
import { SyncManager } from "@/components/sync-manager"
import { DashboardSkeleton } from "@/components/loading-skeleton"
import { offlineStorage } from "@/lib/offline-storage"
import { useToast } from "@/hooks/use-toast"
import { Users, UserCheck, UserX, QrCode, LogOut, Clock, CheckCircle, AlertCircle, RefreshCw, Calendar, MapPin, Type } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
  const isAdmin = ((session as any)?.user?.role === "admin")
  const [stats, setStats] = useState<AttendanceStats>({
    totalStudents: 0,
    presentStudents: 0,
    absentStudents: 0,
    attendanceRate: 0,
  })
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  // Admin: Spreadsheet ID state
  const [spreadsheetId, setSpreadsheetId] = useState("")
  const [isSavingSpreadsheet, setIsSavingSpreadsheet] = useState(false)
  const [sheets, setSheets] = useState<{ title: string; sheetId: number; index: number }[]>([])
  const [activeSheet, setActiveSheet] = useState<{ title?: string; sheetId?: number } | null>(null)
  const [isSavingActiveSheet, setIsSavingActiveSheet] = useState(false)
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [eventSettings, setEventSettings] = useState({ eventName: "", eventVenue: "", eventDate: "", eventTime: "" })
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [unprovisionedCount, setUnprovisionedCount] = useState<number | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  // Conditional rendering variables
  let content: React.ReactNode = null;

  if (
    status === "authenticated" &&
    !isAdmin &&
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

  const fetchUnprovisionedCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch("/api/students")
      if (response.ok) {
        const students = await response.json()
        const count = students.filter((s: any) => s.email && !s.qrId).length
        setUnprovisionedCount(count)
      }
    } catch (error) {
      console.error("Error fetching unprovisioned count:", error)
    }
  }, [isAdmin])

  useEffect(() => {
    if (status === "authenticated") {
      const loadInitialData = async () => {
        setIsInitialLoading(true)
        const promises = [fetchStats(), fetchRecentLogs()]
        if (isAdmin) {
          promises.push(fetchUnprovisionedCount())
        }
        await Promise.all(promises)
        setIsInitialLoading(false)
      }
      loadInitialData()
    }
  }, [status, fetchStats, fetchRecentLogs, fetchUnprovisionedCount, isAdmin])

  // Set up background polling every 10 seconds to keep stats, logs, and provisioning counts dynamically updated
  useEffect(() => {
    if (status !== "authenticated") return;
    
    const interval = setInterval(async () => {
      await fetchStats();
      await fetchRecentLogs();
      if (isAdmin) {
        await fetchUnprovisionedCount();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [status, fetchStats, fetchRecentLogs, fetchUnprovisionedCount, isAdmin]);

  // Admin: load Spreadsheet ID
  useEffect(() => {
    const loadSpreadsheetId = async () => {
      if (!isAdmin) return;
      try {
        const res = await fetch("/api/admin/spreadsheet");
        if (res.ok) {
          const data = await res.json();
          setSpreadsheetId(data.spreadsheetId || "");
        }
      } catch (e) {
        // no-op
      }
    };
    if (status === "authenticated") loadSpreadsheetId();
  }, [status, isAdmin])

  // Admin: load available sheets and active selection
  useEffect(() => {
    const loadSheets = async () => {
      if (!isAdmin) return;
      try {
        const res = await fetch("/api/admin/sheets");
        if (res.ok) {
          const data = await res.json();
          setSheets(data.sheets || []);
          setActiveSheet(data.active || null);
        }
      } catch (e) {
        console.error("[dashboard] Failed to load sheets:", e);
      }
    };
    if (status === "authenticated") loadSheets();

    // Admin: load event settings
    if (isAdmin && status === "authenticated") {
      fetch("/api/admin/settings").then(r => r.json()).then(d => {
        if (!d.error) setEventSettings(d);
      }).catch(e => console.error("Failed to load settings", e));
    }
  }, [status, isAdmin, spreadsheetId])

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

  // Admin: save Spreadsheet ID
  const handleSaveSpreadsheetId = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSpreadsheet(true);
    try {
      const res = await fetch("/api/admin/spreadsheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Saved", description: "Spreadsheet ID updated." });
        await fetchStats();
        await fetchUnprovisionedCount();
        // Reload sheets after saving spreadsheet ID so dropdown populates
        try {
          const res2 = await fetch("/api/admin/sheets");
          if (res2.ok) {
            const data2 = await res2.json();
            setSheets(data2.sheets || []);
            setActiveSheet(data2.active || null);
          }
        } catch (e) {
          console.error("[dashboard] Reload sheets failed:", e);
        }
      } else {
        toast({ title: "Error", description: data.error || "Failed to save.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally {
      setIsSavingSpreadsheet(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventSettings)
      });
      if (res.ok) {
        toast({ title: "Settings Saved", description: "Event details updated successfully." });
      } else {
        toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const refreshData = async () => {
    setIsLoading(true)
    const promises = [fetchStats(), fetchRecentLogs()]
    if (isAdmin) {
      promises.push(fetchUnprovisionedCount())
    }
    await Promise.all(promises)
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
                    <h1 className="text-xl font-bold">TechToVate</h1>
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
                    <h1 className="text-xl font-bold">TechToVate</h1>
                    <p className="text-sm text-muted-foreground">{isAdmin ? "Admin Dashboard" : "Attendance Dashboard"}</p>
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
                      {((session?.user as any)?.role === "admin") ? "Admin" : "Volunteer"}
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

            {!isAdmin && scanStatus !== "idle" && (
              <Alert variant={scanStatus === "success" ? "default" : "destructive"}>
                <div className="flex items-center gap-2">
                  {scanStatus === "success" && <CheckCircle className="w-4 h-4" />}
                  {scanStatus === "error" && <AlertCircle className="w-4 h-4" />}
                  {scanStatus === "duplicate" && <AlertCircle className="w-4 h-4" />}
                  <AlertDescription>{scanMessage}</AlertDescription>
                </div>
              </Alert>
            )}

            {/* QR Scanner - hidden for Admins */}
            {!isAdmin && (
              <div className="flex justify-center">
                <QRScannerComponent onScan={handleQRScan} onError={handleScanError} />
              </div>
            )}

            {/* Admin-only: Spreadsheet ID Config */}
            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Spreadsheet Configuration</CardTitle>
                  <CardDescription>Set the Google Spreadsheet ID used for attendance</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-3" onSubmit={handleSaveSpreadsheetId}>
                    <div className="space-y-2">
                      <Label htmlFor="spreadsheetId">Spreadsheet ID</Label>
                      <Input
                        id="spreadsheetId"
                        value={spreadsheetId}
                        onChange={(e) => setSpreadsheetId(e.target.value)}
                        placeholder="e.g. 1abcDEF..."
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full sm:w-auto" disabled={isSavingSpreadsheet}>
                      {isSavingSpreadsheet ? "Saving..." : "Save"}
                    </Button>
                  </form>
                  {sheets.length > 0 && (
                    <div className="mt-6 space-y-2">
                      <Label>Active Sheet (tab)</Label>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <Select
                          value={activeSheet?.title || undefined}
                          onValueChange={(val) => setActiveSheet((prev) => ({ sheetId: prev?.sheetId, title: val }))}
                        >
                          <SelectTrigger className="w-full sm:w-72">
                            <SelectValue placeholder="Select a sheet" />
                          </SelectTrigger>
                          <SelectContent>
                            {sheets.map((s) => (
                              <SelectItem key={s.sheetId} value={s.title}>{s.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          disabled={isSavingActiveSheet || !activeSheet?.title}
                          onClick={async () => {
                            setIsSavingActiveSheet(true);
                            try {
                              const selected = sheets.find((s) => s.title === activeSheet?.title);
                              const res = await fetch("/api/admin/sheets", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ sheetId: selected?.sheetId, title: selected?.title }),
                              });
                              if (res.ok) {
                                toast({ title: "Active sheet saved" });
                                await fetchStats();
                                await fetchUnprovisionedCount();
                              } else {
                                const data = await res.json();
                                toast({ title: "Error", description: data.error || "Failed to save.", variant: "destructive" });
                              }
                            } finally {
                              setIsSavingActiveSheet(false);
                            }
                          }}
                        >
                          {isSavingActiveSheet ? "Saving..." : "Set Active"}
                        </Button>
                      </div>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="mt-6 space-y-2">
                      <Label>Provision QR Codes & Send Emails</Label>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <Button
                          className="w-full sm:w-auto"
                          onClick={async () => {
                            setIsProvisioning(true);
                            try {
                              const res = await fetch("/api/admin/provision", { method: "POST" });
                              const data = await res.json();
                              if (res.ok) {
                                const { updated = 0, emailed = 0 } = data || {};
                                toast({ title: "Provisioned", description: `Generated ${updated} QR codes and emailed ${emailed} participants.` });
                                await fetchUnprovisionedCount();
                                await fetchStats();
                              } else {
                                toast({ title: "Provision failed", description: data?.error || "Unknown error", variant: "destructive" });
                              }
                            } catch (e) {
                              toast({ title: "Network error", description: "Could not reach provisioning endpoint.", variant: "destructive" });
                            } finally {
                              setIsProvisioning(false);
                            }
                          }}
                          disabled={isProvisioning}
                        >
                          {isProvisioning ? "Running..." : `Provision now ${unprovisionedCount !== null ? `(${unprovisionedCount})` : ""}`}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          {unprovisionedCount !== null
                            ? `${unprovisionedCount} student(s) need provisioning (have email but no QR code).`
                            : "Generates QR_ID for new rows and emails participants."}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Event Configuration</CardTitle>
                  <CardDescription>Customize event details sent in emails</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="eventName">Event Name</Label>
                      <div className="relative">
                        <Type className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="eventName"
                          className="pl-9"
                          value={eventSettings.eventName}
                          onChange={(e) => setEventSettings({ ...eventSettings, eventName: e.target.value })}
                          placeholder="e.g. Annual Tech Summit"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="eventVenue">Venue</Label>
                      <div className="relative">
                        <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="eventVenue"
                          className="pl-9"
                          value={eventSettings.eventVenue}
                          onChange={(e) => setEventSettings({ ...eventSettings, eventVenue: e.target.value })}
                          placeholder="e.g. Main Auditorium"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="eventDate">Date</Label>
                        <div className="relative">
                          <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="eventDate"
                            className="pl-9"
                            value={eventSettings.eventDate}
                            onChange={(e) => setEventSettings({ ...eventSettings, eventDate: e.target.value })}
                            placeholder="e.g. 15th Oct 2023"
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="eventTime">Time</Label>
                        <div className="relative">
                          <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="eventTime"
                            className="pl-9"
                            value={eventSettings.eventTime}
                            onChange={(e) => setEventSettings({ ...eventSettings, eventTime: e.target.value })}
                            placeholder="e.g. 10:00 AM"
                          />
                        </div>
                      </div>
                    </div>
                    <Button type="submit" className="w-full sm:w-auto" disabled={isSavingSettings}>
                      {isSavingSettings ? "Saving..." : "Save Details"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

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

            {!isAdmin && (
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
            )}
          </div>
        </div>
      );
    }
  }

  return content;
}
