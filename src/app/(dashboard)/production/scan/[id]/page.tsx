'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  ArrowLeft,
  ScanLine,
  Package,
  AlertCircle,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  AlertTriangle,
  Loader2,
  ClipboardList,
  Clock,
  User,
  Hash
} from 'lucide-react'
import { format } from 'date-fns'

interface ScanResult {
  type: 'job_route' | 'pallet' | 'material' | 'employee' | 'unknown'
  id: string
  data: any
}

export default function ProductionScanPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const routeId = params.id as string
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [showResultDialog, setShowResultDialog] = useState(false)
  
  // Route details
  const [routeDetails, setRouteDetails] = useState<any>(null)
  const [availableMaterials, setAvailableMaterials] = useState<any[]>([])
  const [consumedMaterials, setConsumedMaterials] = useState<any[]>([])

  useEffect(() => {
    fetchRouteDetails()
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear()
      }
    }
  }, [routeId])

  async function fetchRouteDetails() {
    try {
      const { data: routeData, error } = await supabase
        .from('job_routes')
        .select(`
          *,
          job:jobs (
            job_number,
            job_name,
            job_line_items (
              po_line_item:po_line_items (
                item_name,
                quantity
              )
            )
          ),
          activity:activities (
            name,
            code
          ),
          work_center:work_centers (
            name
          )
        `)
        .eq('id', routeId)
        .single()

      if (error) throw error
      setRouteDetails(routeData)
      
      // Fetch planned materials
      const { data: materialsData } = await supabase
        .from('job_material_consumption')
        .select(`
          *,
          material_product:products (
            id,
            name,
            sku,
            barcode,
            unit_of_measure
          )
        `)
        .eq('job_id', routeData.job_id)
        .is('consumed_at', null)
      
      setAvailableMaterials(materialsData || [])
      
      // Fetch consumed materials
      const { data: consumedData } = await supabase
        .from('job_material_consumption')
        .select(`
          *,
          material_product:products (
            name,
            sku
          )
        `)
        .eq('job_route_id', routeId)
        .not('consumed_at', 'is', null)
      
      setConsumedMaterials(consumedData || [])
      
    } catch (error) {
      console.error('Error fetching route details:', error)
    } finally {
      setLoading(false)
    }
  }

  function initializeScanner() {
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
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
    try {
      // Try to parse as JSON (for QR codes)
      let parsedData: any
      try {
        parsedData = JSON.parse(scanData)
      } catch {
        // Not JSON, treat as raw barcode
        parsedData = { code: scanData }
      }
      
      // Determine scan type and fetch relevant data
      let result: ScanResult | null = null
      
      // Check if it's a pallet QR code
      if (parsedData.type === 'pallet' && parsedData.id) {
        const { data: palletData } = await supabase
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
              code
            )
          `)
          .eq('id', parsedData.id)
          .single()
        
        if (palletData) {
          result = {
            type: 'pallet',
            id: parsedData.id,
            data: palletData
          }
        }
      }
      
      // Check if it's a material barcode
      else if (parsedData.code) {
        const { data: productData } = await supabase
          .from('products')
          .select('*')
          .eq('barcode', parsedData.code)
          .single()
        
        if (productData) {
          result = {
            type: 'material',
            id: productData.id,
            data: productData
          }
        }
      }
      
      // Check if it's an employee badge
      else if (parsedData.type === 'employee' && parsedData.id) {
        const { data: userData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', parsedData.id)
          .single()
        
        if (userData) {
          result = {
            type: 'employee',
            id: parsedData.id,
            data: userData
          }
        }
      }
      
      // Check if it's a job route card
      else if (parsedData.type === 'job_route' && parsedData.id) {
        const { data: jobRouteData } = await supabase
          .from('job_routes')
          .select(`
            *,
            job:jobs (
              job_number,
              job_name
            ),
            activity:activities (
              name
            )
          `)
          .eq('id', parsedData.id)
          .single()
        
        if (jobRouteData) {
          result = {
            type: 'job_route',
            id: parsedData.id,
            data: jobRouteData
          }
        }
      }
      
      if (result) {
        setScanResult(result)
        setShowResultDialog(true)
      } else {
        setScanResult({
          type: 'unknown',
          id: scanData,
          data: { raw: scanData }
        })
        setShowResultDialog(true)
      }
      
    } catch (error) {
      console.error('Error processing scan:', error)
    }
  }

  async function handleManualSubmit() {
    if (!manualInput.trim()) return
    await processScanResult(manualInput)
    setManualInput('')
  }

  async function handleMaterialConsumption(materialId: string, quantity: number) {
    try {
      // Implementation would track material consumption
      console.log('Consuming material:', materialId, quantity)
      await fetchRouteDetails() // Refresh data
      setShowResultDialog(false)
    } catch (error) {
      console.error('Error consuming material:', error)
    }
  }

  async function updateRouteStatus(newStatus: string) {
    try {
      const { error } = await supabase
        .from('job_routes')
        .update({
          status: newStatus,
          ...(newStatus === 'in_progress' && { actual_start: new Date().toISOString() })
        })
        .eq('id', routeId)
      
      if (error) throw error
      await fetchRouteDetails()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!routeDetails) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Production route not found</p>
        </div>
      </div>
    )
  }

  const statusColors = {
    pending: 'bg-gray-100 text-gray-800',
    ready: 'bg-blue-100 text-blue-800',
    setup: 'bg-orange-100 text-orange-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    paused: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    skipped: 'bg-red-100 text-red-800'
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/production')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Production Scanning</h1>
            <p className="text-muted-foreground mt-1">
              {routeDetails.job.job_number} - {routeDetails.activity.name}
            </p>
          </div>
        </div>
        <Badge className={statusColors[routeDetails.status]}>
          {routeDetails.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Information */}
          <Card>
            <CardHeader>
              <CardTitle>Job Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-muted-foreground">Job</dt>
                  <dd className="mt-1">{routeDetails.job.job_name}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Work Center</dt>
                  <dd className="mt-1">{routeDetails.work_center.name}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Activity</dt>
                  <dd className="mt-1">
                    {routeDetails.activity.name} (Step {routeDetails.sequence_number})
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Progress</dt>
                  <dd className="mt-1">
                    {routeDetails.quantity_completed} / {routeDetails.quantity_target} units
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Scanner */}
          <Card>
            <CardHeader>
              <CardTitle>Barcode Scanner</CardTitle>
              <CardDescription>
                Scan barcodes, QR codes, or enter manually
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="scan" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="scan">Camera Scan</TabsTrigger>
                  <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                </TabsList>
                
                <TabsContent value="scan" className="space-y-4">
                  {!scanning ? (
                    <div className="text-center py-8">
                      <ScanLine className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                      <Button onClick={initializeScanner}>
                        Start Scanner
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <div id="qr-reader" className="w-full" />
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
                  <div>
                    <Label htmlFor="manual-input">Barcode / QR Code</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="manual-input"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        placeholder="Enter code manually"
                        onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                      />
                      <Button onClick={handleManualSubmit}>
                        Submit
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {routeDetails.status === 'ready' && (
                <Button onClick={() => updateRouteStatus('in_progress')}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Start Production
                </Button>
              )}
              {routeDetails.status === 'in_progress' && (
                <Button onClick={() => updateRouteStatus('paused')} variant="outline">
                  <PauseCircle className="mr-2 h-4 w-4" />
                  Pause Production
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={() => router.push(`/production/complete/${routeId}`)}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/production/issues/new?jobRouteId=${routeId}`)}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Report Issue
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Materials Section */}
        <div className="space-y-6">
          {/* Planned Materials */}
          <Card>
            <CardHeader>
              <CardTitle>Required Materials</CardTitle>
              <CardDescription>
                Materials needed for this job
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {availableMaterials.length === 0 ? (
                <p className="text-sm text-muted-foreground">No materials required</p>
              ) : (
                availableMaterials.map((material) => (
                  <div key={material.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium text-sm">
                        {material.material_product?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {material.material_product?.sku}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {material.quantity_planned} {material.unit_of_measure}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Consumed Materials */}
          {consumedMaterials.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Consumed Materials</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {consumedMaterials.map((material) => (
                  <div key={material.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium text-sm">
                        {material.material_product?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Lot: {material.lot_number || 'N/A'}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {material.quantity_consumed} {material.unit_of_measure}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Scan Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan Result</DialogTitle>
            <DialogDescription>
              {scanResult?.type === 'unknown' 
                ? 'Unknown barcode format'
                : `Scanned ${scanResult?.type.replace('_', ' ')}`}
            </DialogDescription>
          </DialogHeader>
          
          {scanResult && (
            <div className="space-y-4">
              {scanResult.type === 'material' && (
                <div>
                  <h4 className="font-medium mb-2">Material Details</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Name:</dt>
                      <dd>{scanResult.data.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">SKU:</dt>
                      <dd>{scanResult.data.sku}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Barcode:</dt>
                      <dd>{scanResult.data.barcode}</dd>
                    </div>
                  </dl>
                </div>
              )}
              
              {scanResult.type === 'pallet' && (
                <div>
                  <h4 className="font-medium mb-2">Pallet Details</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Number:</dt>
                      <dd>{scanResult.data.pallet_number}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Location:</dt>
                      <dd>{scanResult.data.current_location?.code || 'Unknown'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Status:</dt>
                      <dd>{scanResult.data.status}</dd>
                    </div>
                  </dl>
                  {scanResult.data.pallet_contents?.length > 0 && (
                    <div className="mt-3">
                      <h5 className="text-sm font-medium mb-1">Contents:</h5>
                      {scanResult.data.pallet_contents.map((content: any) => (
                        <p key={content.id} className="text-sm">
                          • {content.product.name} - {content.total_units_remaining} units
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {scanResult.type === 'employee' && (
                <div>
                  <h4 className="font-medium mb-2">Employee Details</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Name:</dt>
                      <dd>{scanResult.data.full_name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Department:</dt>
                      <dd>{scanResult.data.department || 'N/A'}</dd>
                    </div>
                  </dl>
                </div>
              )}
              
              {scanResult.type === 'unknown' && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Scanned code: {scanResult.data.raw}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    This code was not recognized. Please check if it's a valid barcode.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}