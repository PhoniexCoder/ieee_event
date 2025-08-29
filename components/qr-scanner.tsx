"use client"

import { useState, useEffect } from "react"
import { Scanner } from "@yudiel/react-qr-scanner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, CameraOff, Wifi, WifiOff } from "lucide-react"
import { offlineStorage } from "@/lib/offline-storage"
import { useToast } from "@/hooks/use-toast"

interface QRScannerProps {
  onScan: (result: string) => void
  onError?: (error: string) => void
}

export function QRScannerComponent({ onScan, onError }: QRScannerProps) {
  const { toast } = useToast()
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleScan = async (detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes.length === 0) return;
    const qrText = detectedCodes[0].rawValue;
    try {
      if (isOnline) {
        onScan(qrText)
      } else {
        await offlineStorage.storeAttendance({
          studentId: qrText,
          studentName: 'Offline Scan',
          timestamp: new Date().toISOString()
        })
        toast({
          title: "Scan saved offline",
          description: "Attendance will sync when connection is restored",
        })
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to process scan')
    }
  }

  const handleError = (error: unknown) => {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        setPermissionDenied(true)
      }
      onError?.(error.message)
    } else {
      onError?.('Unknown scanner error')
    }
  }


  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          QR Code Scanner
        </CardTitle>
        <div className="flex items-center justify-center gap-2">
          <Badge variant="default" className="text-xs">
            Active
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
          {permissionDenied ? (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center">
              <CameraOff className="w-12 h-12 text-destructive mb-4" />
              <p className="text-destructive font-medium mb-4">
                Camera access required
              </p>
              <Button
                variant="secondary"
                onClick={() => setPermissionDenied(false)}
              >
                Retry Camera Access
              </Button>
            </div>
          ) : (
            <Scanner
              onScan={(codes) => handleScan(codes)}
              onError={(error) => handleError(error)}
              className="w-full h-full bg-black rounded-lg"
              videoStyle={{
                objectFit: 'cover'
              }}
              constraints={{
                facingMode: 'environment',
                aspectRatio: 1
              }}
            />
          )}
          
          {/* Scanning overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-4 border-2 border-primary rounded-lg">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-0.5 bg-primary/50 animate-pulse" />
            </div>
          </div>

          {/* Online/Offline Status */}
          <div className="absolute top-2 right-2 flex items-center gap-2 text-sm">
            <div className={`flex items-center gap-1 ${isOnline ? 'text-green-400' : 'text-yellow-400'}`}>
              {isOnline ? (
                <Wifi className="w-4 h-4" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          {/* Scanning overlay */}
        </div>

        {/* Controls */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Scan IEEE student QR codes</p>
          <p className="text-xs mt-1">{isOnline ? 
            'Scans will process immediately' : 
            'Scans are being stored offline'}
          </p>
        </div>

      </CardContent>
    </Card>
  )
}
