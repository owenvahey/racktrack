import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductForm } from '@/components/inventory/product-form'

export default function NewProductPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Create New Product</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
          <CardDescription>
            Add a new product to your inventory catalog
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm />
        </CardContent>
      </Card>
    </div>
  )
}