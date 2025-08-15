'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProductWithCaseInfo, ReceivingSession, ReceivingFormData } from '@/types/inventory-enhanced.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Package,
  Plus,
  Trash2,
  Save,
  Loader2,
  Calculator,
  AlertCircle,
  CheckCircle,
  Printer
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ReceivingItemInput {
  product_id: string
  product?: ProductWithCaseInfo
  cases_received: number
  units_per_case_override?: number
  lot_number: string
  expiration_date: string
  calculated_total: number
}

export default function ReceivingPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [currentSession, setCurrentSession] = useState<ReceivingSession | null>(null)
  const [products, setProducts] = useState<ProductWithCaseInfo[]>([])
  
  const [formData, setFormData] = useState<ReceivingFormData>({
    po_reference: '',
    supplier_name: '',
    items: []
  })
  
  const [receivingItems, setReceivingItems] = useState<ReceivingItemInput[]>([])

  useEffect(() => {
    fetchProducts()
    checkActiveSession()
  }, [])

  async function fetchProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  async function checkActiveSession() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('receiving_sessions')
        .select('*')
        .eq('status', 'open')
        .eq('received_by', user.id)
        .single()

      if (data) {
        setCurrentSession(data)
        setFormData({
          po_reference: data.po_reference || '',
          supplier_name: data.supplier_name || '',
          items: []
        })
      }
    } catch (error) {
      // No active session
    }
  }

  async function startSession() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('receiving_sessions')
        .insert({
          po_reference: formData.po_reference,
          supplier_name: formData.supplier_name,
          received_by: user.id
        })
        .select()
        .single()

      if (error) throw error
      setCurrentSession(data)
    } catch (error) {
      console.error('Error starting session:', error)
      setError('Failed to start receiving session')
    } finally {
      setLoading(false)
    }
  }

  function addItem() {
    setReceivingItems([
      ...receivingItems,
      {
        product_id: '',
        cases_received: 1,
        lot_number: '',
        expiration_date: '',
        calculated_total: 0
      }
    ])
  }

  function removeItem(index: number) {
    setReceivingItems(receivingItems.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof ReceivingItemInput, value: any) {
    const updated = [...receivingItems]
    updated[index] = { ...updated[index], [field]: value }

    // If product changed, update units per case and recalculate
    if (field === 'product_id') {
      const product = products.find(p => p.id === value)
      if (product) {
        updated[index].product = product
        updated[index].units_per_case_override = product.units_per_case
        updated[index].calculated_total = updated[index].cases_received * product.units_per_case
      }
    }

    // Recalculate total if cases or units per case changed
    if (field === 'cases_received' || field === 'units_per_case_override') {
      const units_per_case = updated[index].units_per_case_override || 
                            updated[index].product?.units_per_case || 1
      updated[index].calculated_total = updated[index].cases_received * units_per_case
    }

    setReceivingItems(updated)
  }

  async function completeReceiving() {
    if (!currentSession || receivingItems.length === 0) return

    setSaving(true)
    setError(null)

    try {
      // Create pallets and pallet contents
      for (const item of receivingItems) {
        if (!item.product_id || item.cases_received <= 0) continue

        // Create pallet
        const { data: pallet, error: palletError } = await supabase
          .from('pallets')
          .insert({
            status: 'receiving',
            created_by: currentSession.received_by
          })
          .select()
          .single()

        if (palletError) throw palletError

        // Create pallet content
        const units_per_case = item.units_per_case_override || item.product?.units_per_case || 1
        const { error: contentError } = await supabase
          .from('pallet_contents')
          .insert({
            pallet_id: pallet.id,
            product_id: item.product_id,
            case_count: item.cases_received,
            units_per_case: units_per_case,
            cases_remaining: item.cases_received,
            loose_units_remaining: 0,
            lot_number: item.lot_number || null,
            expiration_date: item.expiration_date || null,
            quality_status: 'pending'
          })

        if (contentError) throw contentError

        // Create receiving item record
        const { error: itemError } = await supabase
          .from('receiving_items')
          .insert({
            session_id: currentSession.id,
            pallet_id: pallet.id,
            product_id: item.product_id,
            cases_received: item.cases_received,
            units_per_case: units_per_case
          })

        if (itemError) throw itemError

        // Generate label
        await generatePalletLabel(pallet.id)
      }

      // Update session totals
      const totalCases = receivingItems.reduce((sum, item) => sum + item.cases_received, 0)
      const totalUnits = receivingItems.reduce((sum, item) => sum + item.calculated_total, 0)

      const { error: sessionError } = await supabase
        .from('receiving_sessions')
        .update({
          total_pallets: receivingItems.filter(item => item.product_id && item.cases_received > 0).length,
          total_products: new Set(receivingItems.map(item => item.product_id)).size,
          total_cases: totalCases,
          total_units: totalUnits,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', currentSession.id)

      if (sessionError) throw sessionError

      // Redirect to session summary
      router.push(`/receiving/${currentSession.id}/complete`)
    } catch (error) {
      console.error('Error completing receiving:', error)
      setError('Failed to complete receiving')
    } finally {
      setSaving(false)
    }
  }

  async function generatePalletLabel(palletId: string) {
    try {
      // Get pallet with contents
      const { data: pallet, error: palletError } = await supabase
        .from('pallets')
        .select(`
          *,
          pallet_contents (
            *,
            product:products (*)
          )
        `)
        .eq('id', palletId)
        .single()

      if (palletError || !pallet) throw palletError

      // Create label summary
      const contentSummary = {
        pallet_number: pallet.pallet_number,
        location: pallet.current_location_id || 'Receiving',
        received_date: new Date().toISOString(),
        total_products: pallet.pallet_contents.length,
        total_cases: pallet.pallet_contents.reduce((sum: number, pc: any) => sum + pc.case_count, 0),
        total_units: pallet.pallet_contents.reduce((sum: number, pc: any) => sum + pc.total_units, 0),
        contents: pallet.pallet_contents.map((pc: any) => ({
          product_name: pc.product.name,
          product_sku: pc.product.sku,
          case_count: pc.case_count,
          units_per_case: pc.units_per_case,
          total_units: pc.total_units,
          lot_number: pc.lot_number
        }))
      }

      // Create label record
      const { error: labelError } = await supabase
        .from('pallet_labels')
        .insert({
          pallet_id: palletId,
          label_code: pallet.pallet_number,
          label_type: 'master',
          content_summary: contentSummary,
          printed_by: currentSession?.received_by
        })

      if (labelError) throw labelError
    } catch (error) {
      console.error('Error generating label:', error)
    }
  }

  const totalCases = receivingItems.reduce((sum, item) => sum + item.cases_received, 0)
  const totalUnits = receivingItems.reduce((sum, item) => sum + item.calculated_total, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Receiving</h1>
        <p className="text-muted-foreground mt-2">
          Receive inventory and generate pallet labels
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!currentSession ? (
        <Card>
          <CardHeader>
            <CardTitle>Start Receiving Session</CardTitle>
            <CardDescription>
              Enter reference information to begin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="po_reference">PO Reference (Optional)</Label>
              <Input
                id="po_reference"
                value={formData.po_reference}
                onChange={(e) => setFormData({ ...formData, po_reference: e.target.value })}
                placeholder="PO-12345"
              />
            </div>
            <div>
              <Label htmlFor="supplier_name">Supplier Name</Label>
              <Input
                id="supplier_name"
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                placeholder="Enter supplier name"
              />
            </div>
            <Button onClick={startSession} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Start Session'
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Session Info */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Session {currentSession.session_number}</CardTitle>
                  <CardDescription>
                    {currentSession.supplier_name || 'No supplier specified'}
                    {currentSession.po_reference && ` • PO: ${currentSession.po_reference}`}
                  </CardDescription>
                </div>
                <Badge>Active</Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Receiving Items */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Items to Receive</CardTitle>
                  <CardDescription>
                    Add products with case quantities
                  </CardDescription>
                </div>
                <Button onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {receivingItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items added yet. Click "Add Item" to begin.
                </div>
              ) : (
                <div className="space-y-4">
                  {receivingItems.map((item, index) => (
                    <Card key={index}>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {/* Product Selection */}
                          <div className="lg:col-span-2">
                            <Label>Product</Label>
                            <select
                              className="w-full px-3 py-2 border rounded-md"
                              value={item.product_id}
                              onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                              required
                            >
                              <option value="">Select product</option>
                              {products.map(product => (
                                <option key={product.id} value={product.id}>
                                  {product.name} ({product.sku})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Cases Input */}
                          <div>
                            <Label>Cases</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.cases_received}
                              onChange={(e) => updateItem(index, 'cases_received', parseInt(e.target.value) || 0)}
                              required
                            />
                          </div>

                          {/* Units per Case */}
                          <div>
                            <Label>Units/Case</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.units_per_case_override || item.product?.units_per_case || 1}
                              onChange={(e) => updateItem(index, 'units_per_case_override', parseInt(e.target.value) || 1)}
                            />
                          </div>

                          {/* Lot Number */}
                          <div>
                            <Label>Lot Number</Label>
                            <Input
                              value={item.lot_number}
                              onChange={(e) => updateItem(index, 'lot_number', e.target.value)}
                              placeholder="LOT-123"
                            />
                          </div>

                          {/* Expiration Date */}
                          <div>
                            <Label>Expiration Date</Label>
                            <Input
                              type="date"
                              value={item.expiration_date}
                              onChange={(e) => updateItem(index, 'expiration_date', e.target.value)}
                            />
                          </div>

                          {/* Total Calculation Display */}
                          <div className="lg:col-span-2 flex items-end">
                            <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-md">
                              <Calculator className="h-5 w-5 text-primary" />
                              <span className="font-medium">
                                {item.cases_received} cases × {item.units_per_case_override || item.product?.units_per_case || 1} units/case = 
                                <span className="text-primary ml-1">{item.calculated_total} total units</span>
                              </span>
                            </div>
                          </div>

                          {/* Remove Button */}
                          <div className="flex items-end justify-end">
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Summary */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Items</p>
                          <p className="text-2xl font-bold">{receivingItems.length}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Cases</p>
                          <p className="text-2xl font-bold">{totalCases}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Units</p>
                          <p className="text-2xl font-bold text-primary">{totalUnits.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Actions */}
              {receivingItems.length > 0 && (
                <div className="flex justify-end gap-4 mt-6">
                  <Button variant="outline" disabled={saving}>
                    Cancel Session
                  </Button>
                  <Button onClick={completeReceiving} disabled={saving || receivingItems.length === 0}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Complete & Print Labels
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}