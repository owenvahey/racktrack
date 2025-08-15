'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarcodeScanner } from '@/components/scanning/barcode-scanner'
import { ReceiveForm } from '@/components/inventory/receive-form'
import { ScanLine, Keyboard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Product } from '@/types/inventory.types'

export default function ReceiveInventoryPage() {
  const [scanMode, setScanMode] = useState<'scan' | 'manual'>('scan')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const supabase = createClient()

  const handleScan = async (barcode: string) => {
    try {
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .single()

      if (product) {
        setSelectedProduct(product)
        setScanMode('manual')
        toast.success(`Found product: ${product.name}`)
      } else {
        toast.error('Product not found. Please create it first.')
      }
    } catch (error) {
      console.error('Error finding product:', error)
      toast.error('Error finding product')
    }
  }

  const handleReceiveComplete = () => {
    setSelectedProduct(null)
    setScanMode('scan')
    toast.success('Inventory received successfully')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Receive Inventory</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add Inventory</CardTitle>
          <CardDescription>
            Scan products or enter details manually to receive inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={scanMode} onValueChange={(v) => setScanMode(v as 'scan' | 'manual')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="scan">
                <ScanLine className="h-4 w-4 mr-2" />
                Scan Barcode
              </TabsTrigger>
              <TabsTrigger value="manual">
                <Keyboard className="h-4 w-4 mr-2" />
                Manual Entry
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scan" className="mt-6">
              <div className="space-y-4">
                <BarcodeScanner
                  onScan={handleScan}
                  onError={(error) => toast.error(error)}
                  continuous={false}
                />
                <p className="text-sm text-muted-foreground text-center">
                  Scan a product barcode to begin receiving
                </p>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="mt-6">
              <ReceiveForm
                preselectedProduct={selectedProduct}
                onComplete={handleReceiveComplete}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}