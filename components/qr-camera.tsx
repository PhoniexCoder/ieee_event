
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
    codeReader.decodeFromVideoDevice(selectedDeviceId, videoRef.current, (res, err) => {
      if (res) {
        setStatus('QR code found: ' + res.getText());
        setResult(res.getText());
        setScanning(false);
  setCameraOn(false);
      }
      if (err && err.message) {
        setError(err.message);
        setStatus('Camera error: ' + err.message);
        setScanning(false);
  setCameraOn(false);
      }
    });
    return () => {
  // Cleanup handled by effect/state
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
