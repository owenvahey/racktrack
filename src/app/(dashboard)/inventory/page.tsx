import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function InventoryPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Inventory Management</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            The inventory management module will be available in Phase 3
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This module will include:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
            <li>Product catalog management</li>
            <li>Real-time inventory tracking</li>
            <li>Barcode scanning</li>
            <li>Location management</li>
            <li>Inventory movements and audit trail</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}