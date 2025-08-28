"use client"

import { useRef, useState } from 'react';
import { BrowserMultiFormatReader, BrowserQRCodeReader } from '@zxing/browser';

export default function QRCamera() {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [result, setResult] = useState('');
  const [status, setStatus] = useState('');
  const [scanning, setScanning] = useState(false);
  const [galleryImage, setGalleryImage] = useState(null);

  const handleQRResult = async (qrText, codeReader) => {
    setResult(qrText);
    setStatus('Sending to backend...');
    setScanning(true);
    try {
      const response = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrId: qrText }),
      });
      const data = await response.json();
      if (data.success) {
        setStatus('✅ Row highlighted in sheet!');
      } else {
        setStatus('❌ ' + (data.message || 'Not found'));
      }
    } catch (err) {
      setStatus('❌ Error sending to backend.');
    }
    setScanning(false);
    if (codeReader) codeReader.reset();
  };

  const startScan = async () => {
    setStatus('Starting camera...');
    setScanning(true);
    setGalleryImage(null);
    const codeReader = new BrowserMultiFormatReader();
    try {
      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      const selectedDeviceId = videoInputDevices[0].deviceId;
      setStatus('Scanning live...');
      codeReader.decodeFromVideoDevice(selectedDeviceId, videoRef.current, async (res, err) => {
        if (res) {
          setStatus('QR code found: ' + res.getText());
          handleQRResult(res.getText(), codeReader);
        }
      });
    } catch (e) {
      setStatus('Camera error: ' + e.message);
      setScanning(false);
    }
  };

  const handleGalleryClick = () => {
    if (fileInputRef.current) fileInputRef.current.value = null;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      setStatus('No file selected.');
      return;
    }
    setStatus('Uploading image...');
    setGalleryImage(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      setGalleryImage(event.target.result);
      setStatus('Scanning image...');
      const img = new window.Image();
      img.src = event.target.result;
      img.onload = async () => {
        try {
          const codeReader = new BrowserQRCodeReader();
          const result = await codeReader.decodeFromImageElement(img);
          setStatus('QR code found: ' + result.getText());
          handleQRResult(result.getText(), null);
        } catch (err) {
          setStatus('❌ No QR code found in image.');
        }
      };
      img.onerror = (err) => {
        setStatus('Error loading image.');
      };
    };
    reader.onerror = (err) => {
      setStatus('Error reading file.');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center min-h-screen min-w-full bg-gradient-to-br from-blue-50 to-blue-200">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl border border-blue-100 flex flex-col items-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="rounded shadow border w-full max-w-md aspect-video bg-black"
          style={{ display: scanning && !galleryImage ? 'block' : 'none' }}
        />
        {galleryImage && (
          <img src={galleryImage} alt="QR from gallery" className="rounded shadow border w-full max-w-md aspect-video object-contain bg-gray-100" style={{ maxHeight: 320 }} />
        )}
        <p className="mt-4 text-gray-600 text-center">Scan a QR code using your camera or import an image from your gallery.</p>
        <div className="flex gap-4 mt-4">
          <button onClick={startScan} className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition disabled:opacity-50" disabled={scanning && !galleryImage}>
            {scanning && !galleryImage ? 'Scanning...' : 'Start Scan'}
          </button>
          <button onClick={handleGalleryClick} className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition" disabled={scanning && !galleryImage}>
            Scan from Gallery
          </button>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
        <div className="mt-4 text-center text-base font-medium min-h-[1.5em]">
          {status}
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
