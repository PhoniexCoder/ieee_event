"use client";

import { useRef, useState, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

export default function QRCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [result, setResult] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const [cameraOn, setCameraOn] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Start camera and scan on mount
  useEffect(() => {
    (async () => {
      try {
        setStatus('Detecting cameras...');
        const foundDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        setDevices(foundDevices);
        if (foundDevices.length > 0) {
          setSelectedDeviceId(foundDevices[0].deviceId);
          setError(null);
        } else {
          setError('No camera found.');
        }
      } catch (e: any) {
        setError(e?.message || 'Camera detection error');
      }
    })();
  }, []);

  // Start/stop scanning when cameraOn or selectedDeviceId changes
  useEffect(() => {
    if (!cameraOn || !selectedDeviceId || !videoRef.current) return;

    setStatus('Starting camera...');
    setScanning(true);
    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

        navigator.mediaDevices.getUserMedia({ video: { deviceId: selectedDeviceId } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            codeReader.decodeFromVideoElement(videoRef.current!, (result, error) => {
              if (result) {
                setStatus('QR code found: ' + result.getText());
                setResult(result.getText());
                setScanning(false);
                setCameraOn(false);
              }
              if (error && error.name !== "NotFoundException") {
                setError(error.message);
                setStatus('Camera error: ' + error.message);
                setScanning(false);
                setCameraOn(false);
              }
            });
          };
        }
      })
      .catch(err => {
        setError(err.message || 'Failed to get camera stream');
        setScanning(false);
        setCameraOn(false);
      });

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
        codeReaderRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [cameraOn, selectedDeviceId]);

  const handleStart = () => {
    setError(null);
    setResult('');
    setCameraOn(true);
  };

  const handleStop = () => {
    setCameraOn(false);
    setScanning(false);
  // Cleanup handled by effect/state
    setStatus('Camera stopped.');
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center min-h-screen min-w-full bg-gradient-to-br from-blue-50 to-blue-200">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl border border-blue-100 flex flex-col items-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="rounded shadow border w-full max-w-md aspect-video bg-black"
          style={{ display: cameraOn ? 'block' : 'none' }}
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleStart}
            className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition disabled:opacity-50"
            disabled={cameraOn || !selectedDeviceId}
          >
            Start Camera
          </button>
          <button
            onClick={handleStop}
            className="px-4 py-2 bg-red-600 text-white rounded shadow hover:bg-red-700 transition disabled:opacity-50"
            disabled={!cameraOn}
          >
            Stop Camera
          </button>
          {devices.length > 1 && (
            <select
              className="ml-2 border rounded px-2 py-1 text-sm"
              value={selectedDeviceId || ''}
              onChange={e => setSelectedDeviceId(e.target.value)}
              disabled={cameraOn}
            >
              {devices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId}`}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="mt-4 text-center text-base font-medium min-h-[1.5em]">
          {error ? (
            <span className="text-red-600 font-semibold">{error}</span>
          ) : status}
        </div>
        {result && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-blue-800 w-full text-center break-words">
            <span className="font-semibold">Scanned QR:</span> {result}
          </div>
        )}
      </div>
    </div>
  );
}