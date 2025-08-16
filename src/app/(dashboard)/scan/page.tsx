'use client'

import { BarcodeScanner } from '@/components/scanning/barcode-scanner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Package, MapPin, Loader2, Factory, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ScanPage() {
  const router = useRouter()
  const [isScanning, setIsScanning] = useState(true)
  const [scanResult, setScanResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const handleScan = async (result: string) => {
    setIsLoading(true)
    setIsScanning(false)

    try {
      // First try to find a product by barcode
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', result)
        .single()

      if (product) {
        setScanResult({ type: 'product', data: product })
        toast.success(`Found product: ${product.name}`)
        return
      }

      // Then try to find a pallet by QR code
      const { data: pallet } = await supabase
        .from('pallets')
        .select(`
          *,
          current_location:storage_slots(
            id,
            code,
            shelf:shelves(
              code,
              aisle:aisles(
                code,
                warehouse:warehouses(name, code)
              )
            )
          )
        `)
        .or(`pallet_number.eq.${result},qr_code.eq.${result}`)
        .single()

      if (pallet) {
        setScanResult({ type: 'pallet', data: pallet })
        toast.success(`Found pallet: ${pallet.pallet_number}`)
        return
      }

      // Not found
      toast.error('No product or pallet found with this code')
      setScanResult(null)
      setIsScanning(true)
    } catch (error) {
      console.error('Scan error:', error)
      toast.error('Error processing scan')
      setIsScanning(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleScanError = (error: string) => {
    toast.error(error)
  }

  const resetScanner = () => {
    setScanResult(null)
    setIsScanning(true)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scan Items</h1>
          <p className="text-muted-foreground mt-2">
            Scan inventory items or access production scanning
          </p>
        </div>
        <Button 
          variant="outline"
          onClick={() => router.push('/production/scan')}
        >
          <Factory className="mr-2 h-4 w-4" />
          Production Scanner
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Barcode Scanner</CardTitle>
          <CardDescription>
            Scan product barcodes or pallet QR codes to view details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isScanning && !scanResult ? (
            <div className="space-y-4">
              <BarcodeScanner
                onScan={handleScan}
                onError={handleScanError}
                continuous={false}
              />
              <p className="text-sm text-muted-foreground text-center">
                Position the barcode or QR code within the camera view
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : scanResult ? (
            <div className="space-y-4">
              {scanResult.type === 'product' ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Package className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Product Details</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">SKU</p>
                      <p className="font-medium">{scanResult.data.sku}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{scanResult.data.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Category</p>
                      <p className="font-medium">{scanResult.data.category || '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Barcode</p>
                      <p className="font-medium">{scanResult.data.barcode}</p>
                    </div>
                  </div>
                  {scanResult.data.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="text-sm">{scanResult.data.description}</p>
                    </div>
                  )}
                </div>
              ) : scanResult.type === 'pallet' ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Pallet Details</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Pallet Number</p>
                      <p className="font-medium">{scanResult.data.pallet_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-medium capitalize">{scanResult.data.status}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium capitalize">{scanResult.data.pallet_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium">
                        {scanResult.data.current_location ? (
                          <>
                            {scanResult.data.current_location.shelf.aisle.warehouse.code}-
                            {scanResult.data.current_location.shelf.aisle.code}-
                            {scanResult.data.current_location.shelf.code}-
                            {scanResult.data.current_location.code}
                          </>
                        ) : (
                          'Not assigned'
                        )}
                      </p>
                    </div>
                  </div>
                  {scanResult.data.notes && (
                    <div>
                      <p className="text-sm text-muted-foreground">Notes</p>
                      <p className="text-sm">{scanResult.data.notes}</p>
                    </div>
                  )}
                </div>
              ) : null}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button onClick={resetScanner}>
                  Scan Another
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}