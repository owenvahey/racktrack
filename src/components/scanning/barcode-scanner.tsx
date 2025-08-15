'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Camera, CameraOff } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (result: string) => void
  onError?: (error: string) => void
  continuous?: boolean
  cameraFacing?: 'front' | 'back'
}

export function BarcodeScanner({ 
  onScan, 
  onError, 
  continuous = false,
  cameraFacing = 'back' 
}: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const hasScanned = useRef(false)

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner

    return () => {
      if (scanner && isScanning) {
        scanner.stop().catch(console.error)
      }
    }
  }, [])

  const startScanning = async () => {
    if (!scannerRef.current) return

    try {
      const cameras = await Html5Qrcode.getCameras()
      if (cameras && cameras.length > 0) {
        setHasPermission(true)
        
        // Select the back camera if available
        const selectedCamera = cameras.find(camera => 
          camera.label.toLowerCase().includes(cameraFacing)
        ) || cameras[0]

        await scannerRef.current.start(
          selectedCamera.id,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            if (!continuous && hasScanned.current) return
            
            hasScanned.current = true
            onScan(decodedText)
            
            if (!continuous) {
              stopScanning()
            }
          },
          (errorMessage) => {
            // Ignore QR code not found errors
            if (!errorMessage.includes('No MultiFormat Readers')) {
              console.log(errorMessage)
            }
          }
        )
        
        setIsScanning(true)
      } else {
        onError?.('No cameras found')
      }
    } catch (err: any) {
      console.error('Failed to start scanner:', err)
      onError?.(err.message || 'Failed to start scanner')
      setHasPermission(false)
    }
  }

  const stopScanning = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop()
        setIsScanning(false)
        hasScanned.current = false
      } catch (err) {
        console.error('Failed to stop scanner:', err)
      }
    }
  }

  useEffect(() => {
    startScanning()
    return () => {
      stopScanning()
    }
  }, [])

  return (
    <div className="relative">
      <div 
        id="qr-reader" 
        className="w-full max-w-md mx-auto rounded-lg overflow-hidden bg-black"
        style={{ minHeight: '300px' }}
      />
      
      {!hasPermission && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center space-y-4">
            <CameraOff className="h-12 w-12 text-gray-400 mx-auto" />
            <p className="text-sm text-gray-600">Camera permission required</p>
            <Button onClick={startScanning} size="sm">
              <Camera className="h-4 w-4 mr-2" />
              Enable Camera
            </Button>
          </div>
        </div>
      )}
      
      <div className="mt-4 flex justify-center space-x-2">
        {isScanning ? (
          <Button onClick={stopScanning} variant="outline" size="sm">
            <CameraOff className="h-4 w-4 mr-2" />
            Stop Scanning
          </Button>
        ) : (
          <Button onClick={startScanning} size="sm">
            <Camera className="h-4 w-4 mr-2" />
            Start Scanning
          </Button>
        )}
      </div>
    </div>
  )
}