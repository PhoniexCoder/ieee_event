"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { BrowserMultiFormatReader } from "@zxing/browser"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, CameraOff, Flashlight, FlashlightOff } from "lucide-react"

interface QRScannerProps {
  onScan: (result: string) => void
  onError?: (error: string) => void
  isScanning?: boolean
}

export function QRScannerComponent({ onScan, onError, isScanning = true }: QRScannerProps) {
  const [isCameraOn, setIsCameraOn] = useState(isScanning)
  const [torchOn, setTorchOn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [permissionRequested, setPermissionRequested] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)

  // ZXing scan handler
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
      const errorMessage = error?.message || "Camera access failed"
      console.error("[] QR Scanner error:", error)
      setError(errorMessage)
      onError?.(errorMessage)
    },
    [onError],
  )

  // Start/stop camera and scanning
  // Prompt for camera permission and enumerate devices
  const enumerateDevices = useCallback(async () => {
    try {
      setPermissionRequested(true);
      // Prompt for permission by requesting any camera
      await navigator.mediaDevices.getUserMedia({ video: true });
      const foundDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      setDevices(foundDevices);
      if (foundDevices.length > 0) {
        // Prefer back/rear camera
        let selected = foundDevices.find(d => /back|rear/i.test(d.label)) || foundDevices[0];
        setSelectedDeviceId(selected.deviceId);
        setError(null);
      } else {
        setError("No camera found. Please ensure your device has a camera and permission is granted.");
      }
    } catch (e: any) {
      setError(e.message || "Camera error. Please grant camera permission and reload.");
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    if (isCameraOn && !permissionRequested) {
      enumerateDevices();
    }
  }, [isCameraOn, permissionRequested, enumerateDevices]);

  useEffect(() => {
    if (isCameraOn && videoRef.current && selectedDeviceId) {
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;
      let stopped = false;
      (async () => {
        try {
          codeReader.decodeFromVideoDevice(selectedDeviceId, videoRef.current!, (res, err) => {
            if (stopped) return;
            if (res) {
              handleZXingResult(res.getText());
            }
            if (err && err.name !== "NotFoundException") {
              handleError(err);
            }
          });
        } catch (e: any) {
          setError(e.message || "Camera error");
        }
      })();
      return () => {
        stopped = true;
  codeReaderRef.current = null;
      };
    }
    // Stop camera if not on
    if ((!isCameraOn || !selectedDeviceId) && codeReaderRef.current) {
  codeReaderRef.current = null;
    }
  }, [isCameraOn, selectedDeviceId, handleZXingResult, handleError]);

  const toggleCamera = () => {
    setIsCameraOn(!isCameraOn)
    setError(null)
  }

  const toggleTorch = () => {
    setTorchOn(!torchOn)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          QR Code Scanner
        </CardTitle>
        <div className="flex items-center justify-center gap-2">
          <Badge variant={isCameraOn ? "default" : "secondary"} className="text-xs">
            {isCameraOn ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
            {error.includes('No camera found') || error.toLowerCase().includes('permission') ? (
              <Button size="sm" className="mt-2" onClick={enumerateDevices}>
                Retry Camera Access
              </Button>
            ) : null}
          </Alert>
        )}

        <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
          {isCameraOn && !error ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover rounded-lg"
              style={{ background: "black" }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <CameraOff className="w-12 h-12 mx-auto" />
                <p className="text-sm">Camera is off</p>
              </div>
            </div>
          )}

          {/* Scanning overlay */}
          {isCameraOn && (
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
            <Button variant={isCameraOn ? "destructive" : "default"} size="sm" onClick={toggleCamera} className="flex-1">
              {isCameraOn ? (
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
            {isCameraOn && (
              <Button variant="outline" size="sm" onClick={toggleTorch} disabled={!isCameraOn}>
                {torchOn ? <FlashlightOff className="w-4 h-4" /> : <Flashlight className="w-4 h-4" />}
              </Button>
            )}
          </div>
          {/* Camera selection dropdown */}
          {devices.length > 1 && (
            <select
              className="mt-2 border rounded px-2 py-1 text-sm"
              value={selectedDeviceId || ''}
              onChange={e => setSelectedDeviceId(e.target.value)}
              disabled={!isCameraOn}
            >
              {devices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId}`}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Position the QR code within the frame</p>
          <p className="text-xs mt-1">Scanning will happen automatically</p>
        </div>
      </CardContent>
    </Card>
  )
}
