"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { BrowserQRCodeReader } from "@zxing/browser"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, CameraOff, Flashlight, FlashlightOff } from "lucide-react"

interface QRScannerProps {
  onScan: (result: string) => void
  onError?: (error: string) => void
}

export function QRScannerComponent({ onScan, onError }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null)

  const handleZXingResult = useCallback(
    (result: string) => {
      if (result && result !== lastScan) {
        console.log("[] QR Code scanned:", result)
        setLastScan(result)
        onScan(result)
        setTimeout(() => setLastScan(null), 2000)
      }
    },
    [onScan, lastScan],
  )

  const handleError = useCallback(
    (error: any) => {
      console.error("[] QR Scanner error:", error)
      const errorMessage = `[${error.name}] ${error.message}` || "Camera access failed"
      setError(errorMessage)
      onError?.(errorMessage)
    },
    [onError],
  )

  const startScan = async () => {
    setError(null)
    setScanning(true)
    codeReaderRef.current = new BrowserQRCodeReader()
    try {
      await codeReaderRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result, err, controls) => {
          if (result) {
            controls.stop()
            setScanning(false)
            handleZXingResult(result.getText())
          }
          if (err && err.name !== "NotFoundException") {
            handleError(err)
            controls.stop()
            setScanning(false)
          }
        },
      )
    } catch (err: any) {
      handleError(err)
      setScanning(false)
    }
  }

  const stopScan = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset()
      codeReaderRef.current = null
    }
    setScanning(false)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          QR Code Scanner
        </CardTitle>
        <div className="flex items-center justify-center gap-2">
          <Badge variant={scanning ? "default" : "secondary"} className="text-xs">
            {scanning ? "Active" : "Inactive"}
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
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover rounded-lg"
            style={{ background: "black", display: scanning ? "block" : "none" }}
          />
          {!scanning && (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <CameraOff className="w-12 h-12 mx-auto" />
                <p className="text-sm">Camera is off</p>
              </div>
            </div>
          )}

          {/* Scanning overlay */}
          {scanning && (
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
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2 justify-center items-center">
          <div className="w-full flex gap-2">
            <Button variant={scanning ? "destructive" : "default"} size="sm" onClick={scanning ? stopScan : startScan} className="flex-1">
              {scanning ? (
                <>
                  <CameraOff className="w-4 h-4 mr-2" />
                  Stop Camera
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Start Camera
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Position the QR code within the frame</p>
          <p className="text-xs mt-1">Scanning will happen automatically</p>
        </div>
      </CardContent>
    </Card>
  )
}
