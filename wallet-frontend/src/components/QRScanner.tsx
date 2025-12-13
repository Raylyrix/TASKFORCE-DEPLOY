'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Camera } from 'lucide-react'

interface QRScannerProps {
  onScan: (result: string) => void
  onClose: () => void
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const startScanning = async () => {
      try {
        const html5QrCode = new Html5Qrcode('qr-reader')
        scannerRef.current = html5QrCode

        await html5QrCode.start(
          { facingMode: 'environment' }, // Use back camera
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            onScan(decodedText)
            stopScanning()
          },
          (errorMessage) => {
            // Ignore scanning errors
          }
        )
        setIsScanning(true)
      } catch (err: any) {
        setError(err.message || 'Failed to start camera')
      }
    }

    startScanning()

    return () => {
      stopScanning()
    }
  }, [])

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current = null
          setIsScanning(false)
        })
        .catch((err) => {
          console.error('Error stopping scanner:', err)
        })
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Scan QR Code</h2>
          <button
            onClick={() => {
              stopScanning()
              onClose()
            }}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p>{error}</p>
            <button
              onClick={() => {
                setError('')
                window.location.reload()
              }}
              className="mt-2 text-sm underline"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              id="qr-reader"
              ref={containerRef}
              className="w-full rounded-lg overflow-hidden"
            />
            {!isScanning && (
              <div className="text-center text-gray-600">
                <Camera className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>Starting camera...</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => {
            stopScanning()
            onClose()
          }}
          className="mt-4 w-full bg-gray-200 text-gray-900 py-2 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

