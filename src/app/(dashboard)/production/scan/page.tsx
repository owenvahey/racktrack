'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ScanLine,
  Package,
  AlertCircle,
  Loader2,
  ClipboardList,
  User,
  Hash,
  ArrowRight,
  Search
} from 'lucide-react'

export default function ProductionScanMainPage() {
  const router = useRouter()
  const supabase = createClient()
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  
  const [scanning, setScanning] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<any>(null)

  function initializeScanner() {
    const config = {
      fps: 10,
      qrbox: { width: 300, height: 300 },
      supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
    }
    
    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      config,
      false
    )
    
    scannerRef.current.render(onScanSuccess, onScanError)
    setScanning(true)
  }

  async function onScanSuccess(decodedText: string) {
    if (scannerRef.current) {
      scannerRef.current.clear()
      setScanning(false)
    }
    
    await processScanResult(decodedText)
  }

  function onScanError(error: string) {
    // Ignore continuous scan errors
  }

  async function processScanResult(scanData: string) {
    setProcessing(true)
    setError(null)
    setScanResult(null)
    
    try {
      // Try to parse as JSON (for QR codes)
      let parsedData: any
      try {
        parsedData = JSON.parse(scanData)
      } catch {
        // Not JSON, treat as raw barcode
        parsedData = { code: scanData }
      }
      
      // Handle different scan types
      
      // 1. Job Route QR Code
      if (parsedData.type === 'job_route' && parsedData.id) {
        const { data: routeData, error } = await supabase
          .from('job_routes')
          .select(`
            *,
            job:jobs (
              job_number,
              job_name
            ),
            activity:activities (
              name
            ),
            work_center:work_centers (
              name
            )
          `)
          .eq('id', parsedData.id)
          .single()
        
        if (error) throw error
        
        if (routeData) {
          setScanResult({
            type: 'job_route',
            data: routeData
          })
          
          // Redirect to the specific route scan page
          setTimeout(() => {
            router.push(`/production/scan/${parsedData.id}`)
          }, 1000)
        }
      }
      
      // 2. Pallet QR Code
      else if (parsedData.type === 'pallet' && parsedData.id) {
        const { data: palletData, error } = await supabase
          .from('pallets')
          .select(`
            *,
            pallet_contents (
              *,
              product:products (
                name,
                sku
              )
            ),
            current_location:storage_slots (
              code,
              aisle:aisles (
                name
              )
            )
          `)
          .eq('id', parsedData.id)
          .single()
        
        if (error) throw error
        
        if (palletData) {
          setScanResult({
            type: 'pallet',
            data: palletData
          })
        }
      }
      
      // 3. Product Barcode
      else if (parsedData.code) {
        const { data: productData, error } = await supabase
          .from('products')
          .select('*')
          .eq('barcode', parsedData.code)
          .single()
        
        if (error) {
          // Try SKU if barcode doesn't match
          const { data: skuData } = await supabase
            .from('products')
            .select('*')
            .eq('sku', parsedData.code)
            .single()
          
          if (skuData) {
            setScanResult({
              type: 'product',
              data: skuData
            })
          } else {
            throw new Error('Product not found')
          }
        } else {
          setScanResult({
            type: 'product',
            data: productData
          })
        }
      }
      
      // 4. Employee Badge
      else if (parsedData.type === 'employee' && parsedData.id) {
        const { data: userData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', parsedData.id)
          .single()
        
        if (error) throw error
        
        if (userData) {
          setScanResult({
            type: 'employee',
            data: userData
          })
        }
      }
      
      else {
        setError('Unknown scan format')
        setScanResult({
          type: 'unknown',
          raw: scanData
        })
      }
      
    } catch (error: any) {
      console.error('Error processing scan:', error)
      setError(error.message || 'Failed to process scan')
    } finally {
      setProcessing(false)
    }
  }

  async function handleManualSubmit() {
    if (!manualInput.trim()) return
    await processScanResult(manualInput)
    setManualInput('')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Production Scanner</h1>
        <p className="text-muted-foreground mt-2">
          Scan job routes, pallets, materials, or employee badges
        </p>
      </div>

      {/* Scanner Card */}
      <Card>
        <CardHeader>
          <CardTitle>Barcode / QR Code Scanner</CardTitle>
          <CardDescription>
            Use your camera to scan or enter codes manually
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="scan" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="scan">Camera Scan</TabsTrigger>
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            </TabsList>
            
            <TabsContent value="scan" className="space-y-4">
              {!scanning ? (
                <div className="text-center py-12">
                  <ScanLine className="mx-auto h-24 w-24 text-muted-foreground mb-6" />
                  <Button size="lg" onClick={initializeScanner}>
                    Start Camera Scanner
                  </Button>
                  <p className="text-sm text-muted-foreground mt-4">
                    Position the barcode or QR code within the camera frame
                  </p>
                </div>
              ) : (
                <div>
                  <div id="qr-reader" className="w-full rounded-lg overflow-hidden" />
                  <Button 
                    variant="outline" 
                    className="w-full mt-4"
                    onClick={() => {
                      if (scannerRef.current) {
                        scannerRef.current.clear()
                        setScanning(false)
                      }
                    }}
                  >
                    Stop Scanner
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="manual" className="space-y-4">
              <div className="py-8">
                <Label htmlFor="manual-input">Enter Code</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="manual-input"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Scan or type barcode/QR code"
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                    className="text-lg"
                  />
                  <Button 
                    onClick={handleManualSubmit}
                    disabled={!manualInput.trim() || processing}
                  >
                    {processing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Enter job route codes, pallet numbers, product SKUs, or barcodes
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Scan Result */}
      {scanResult && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Result</CardTitle>
          </CardHeader>
          <CardContent>
            {scanResult.type === 'job_route' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <ClipboardList className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Job Route Found</p>
                    <p className="text-sm text-muted-foreground">
                      {scanResult.data.job.job_number} - {scanResult.data.activity.name}
                    </p>
                  </div>
                </div>
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    Redirecting to production tracking...
                  </p>
                  <Button 
                    className="w-full"
                    onClick={() => router.push(`/production/scan/${scanResult.data.id}`)}
                  >
                    Go to Production Tracking
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            {scanResult.type === 'pallet' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Package className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Pallet {scanResult.data.pallet_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Location: {scanResult.data.current_location?.code || 'Not assigned'}
                    </p>
                  </div>
                </div>
                
                {scanResult.data.pallet_contents?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Contents:</p>
                    <div className="space-y-2">
                      {scanResult.data.pallet_contents.map((content: any) => (
                        <div key={content.id} className="flex justify-between text-sm">
                          <span>{content.product.name}</span>
                          <span className="text-muted-foreground">
                            {content.total_units_remaining} units
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => router.push(`/inventory/pallets/${scanResult.data.id}`)}
                >
                  View Pallet Details
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
            
            {scanResult.type === 'product' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Hash className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{scanResult.data.name}</p>
                    <p className="text-sm text-muted-foreground">
                      SKU: {scanResult.data.sku}
                    </p>
                  </div>
                </div>
                
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Type</dt>
                    <dd className="font-medium">{scanResult.data.product_type}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">UOM</dt>
                    <dd className="font-medium">{scanResult.data.unit_of_measure}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Current Stock</dt>
                    <dd className="font-medium">{scanResult.data.current_stock || 0}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Barcode</dt>
                    <dd className="font-medium">{scanResult.data.barcode || 'N/A'}</dd>
                  </div>
                </dl>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => router.push(`/inventory/products/${scanResult.data.id}`)}
                >
                  View Product Details
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
            
            {scanResult.type === 'employee' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <User className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{scanResult.data.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {scanResult.data.department || 'Production'}
                    </p>
                  </div>
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Employee badge scanned successfully. Time tracking features coming soon.
                  </AlertDescription>
                </Alert>
              </div>
            )}
            
            {scanResult.type === 'unknown' && (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Unknown code format: {scanResult.raw}
                  </AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground">
                  This code was not recognized. Make sure you're scanning a valid:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Job route QR code</li>
                  <li>Pallet QR code</li>
                  <li>Product barcode or SKU</li>
                  <li>Employee badge</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
          <CardDescription>
            Common production floor actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => router.push('/production')}
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              View Active Jobs
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => router.push('/production/issues')}
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              View Issues
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => router.push('/inventory/receive')}
            >
              <Package className="mr-2 h-4 w-4" />
              Receive Inventory
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => router.push('/inventory/pallets')}
            >
              <Package className="mr-2 h-4 w-4" />
              Manage Pallets
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}