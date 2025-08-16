'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Package,
  MapPin,
  Truck,
  Box,
  Tag,
  FileText
} from 'lucide-react'
import { 
  LabelElement, 
  LabelSize,
  STANDARD_LABEL_SIZES,
  generateElementId
} from '../lib/label-elements'

interface LabelTemplatesProps {
  onSelectTemplate: (elements: LabelElement[], size: LabelSize) => void
  currentSize: LabelSize
}

// Type helper to properly distribute Omit across union types
type OmitId<T> = T extends any ? Omit<T, 'id'> : never

interface Template {
  id: string
  name: string
  description: string
  category: 'location' | 'product' | 'shipping' | 'pallet'
  size: LabelSize
  thumbnail: React.ReactNode
  elements: OmitId<LabelElement>[]
}

const templates: Template[] = [
  {
    id: 'location-basic',
    name: 'Basic Location Label',
    description: 'Simple location code with barcode',
    category: 'location',
    size: STANDARD_LABEL_SIZES.find(s => s.name === '2×1 Small')!,
    thumbnail: (
      <div className="w-full h-full bg-white border rounded p-2 flex flex-col items-center justify-center">
        <div className="text-xs font-bold">WH01-A01-S01-01</div>
        <div className="w-full h-4 bg-gray-200 mt-1" />
      </div>
    ),
    elements: [
      {
        type: 'text',
        x: 10,
        y: 15,
        width: 180,
        height: 25,
        content: 'Location Code',
        fontSize: 18,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        color: '#000000',
        align: 'center',
        isVariable: true,
        dataField: 'location.full'
      },
      {
        type: 'barcode',
        x: 10,
        y: 45,
        width: 180,
        height: 40,
        value: 'WH01A01S0101',
        format: 'CODE128',
        showText: false,
        textPosition: 'bottom',
        isVariable: true,
        dataField: 'location.full'
      }
    ]
  },
  {
    id: 'product-standard',
    name: 'Product Label',
    description: 'Product name, SKU, and barcode',
    category: 'product',
    size: STANDARD_LABEL_SIZES.find(s => s.name === '2×4 Product')!,
    thumbnail: (
      <div className="w-full h-full bg-white border rounded p-2 flex flex-col">
        <div className="text-xs font-bold">Product Name</div>
        <div className="text-xs text-gray-600">SKU-12345</div>
        <div className="flex-1" />
        <div className="w-full h-6 bg-gray-200" />
      </div>
    ),
    elements: [
      {
        type: 'text',
        x: 10,
        y: 10,
        width: 180,
        height: 30,
        content: 'Product Name',
        fontSize: 16,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        color: '#000000',
        align: 'left',
        isVariable: true,
        dataField: 'product.name'
      },
      {
        type: 'text',
        x: 10,
        y: 45,
        width: 180,
        height: 20,
        content: 'SKU',
        fontSize: 12,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#666666',
        align: 'left',
        isVariable: true,
        dataField: 'product.sku'
      },
      {
        type: 'barcode',
        x: 10,
        y: 80,
        width: 180,
        height: 60,
        value: '123456789012',
        format: 'CODE128',
        showText: true,
        textPosition: 'bottom',
        isVariable: true,
        dataField: 'product.barcode'
      },
      {
        type: 'text',
        x: 10,
        y: 150,
        width: 90,
        height: 20,
        content: 'Qty: {{inventory.quantity}}',
        fontSize: 11,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        align: 'left',
        isVariable: true,
        dataField: 'inventory.quantity'
      },
      {
        type: 'text',
        x: 100,
        y: 150,
        width: 90,
        height: 20,
        content: 'Lot: {{inventory.lot}}',
        fontSize: 11,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        align: 'right',
        isVariable: true,
        dataField: 'inventory.lot'
      }
    ]
  },
  {
    id: 'pallet-comprehensive',
    name: 'Pallet Label',
    description: 'Complete pallet information with QR code',
    category: 'pallet',
    size: STANDARD_LABEL_SIZES.find(s => s.name === '4×4 Pallet')!,
    thumbnail: (
      <div className="w-full h-full bg-white border rounded p-2 grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <div className="text-xs font-bold">PAL-20240115-001</div>
          <div className="text-xs">Location: A01-S01</div>
          <div className="text-xs">Weight: 500kg</div>
        </div>
        <div className="bg-gray-200 rounded" />
      </div>
    ),
    elements: [
      {
        type: 'text',
        x: 20,
        y: 20,
        width: 360,
        height: 40,
        content: 'Pallet Number',
        fontSize: 24,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        color: '#000000',
        align: 'center',
        isVariable: true,
        dataField: 'pallet.number'
      },
      {
        type: 'line',
        x: 20,
        y: 70,
        x2: 380,
        y2: 70,
        width: 360,
        height: 2,
        stroke: '#000000',
        strokeWidth: 2
      },
      {
        type: 'qrcode',
        x: 20,
        y: 90,
        width: 120,
        height: 120,
        value: 'PAL-20240115-001',
        errorCorrectionLevel: 'M',
        isVariable: true,
        dataField: 'pallet.number'
      },
      {
        type: 'text',
        x: 160,
        y: 90,
        width: 100,
        height: 25,
        content: 'Location:',
        fontSize: 14,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        color: '#000000',
        align: 'left'
      },
      {
        type: 'text',
        x: 260,
        y: 90,
        width: 120,
        height: 25,
        content: '{{location.full}}',
        fontSize: 14,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        align: 'left',
        isVariable: true,
        dataField: 'location.full'
      },
      {
        type: 'text',
        x: 160,
        y: 120,
        width: 100,
        height: 25,
        content: 'Weight:',
        fontSize: 14,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        color: '#000000',
        align: 'left'
      },
      {
        type: 'text',
        x: 260,
        y: 120,
        width: 120,
        height: 25,
        content: '{{pallet.weight}}',
        fontSize: 14,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        align: 'left',
        isVariable: true,
        dataField: 'pallet.weight'
      },
      {
        type: 'text',
        x: 160,
        y: 150,
        width: 100,
        height: 25,
        content: 'Status:',
        fontSize: 14,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        color: '#000000',
        align: 'left'
      },
      {
        type: 'text',
        x: 260,
        y: 150,
        width: 120,
        height: 25,
        content: '{{pallet.status}}',
        fontSize: 14,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        align: 'left',
        isVariable: true,
        dataField: 'pallet.status'
      },
      {
        type: 'line',
        x: 20,
        y: 230,
        x2: 380,
        y2: 230,
        width: 360,
        height: 2,
        stroke: '#000000',
        strokeWidth: 2
      },
      {
        type: 'text',
        x: 20,
        y: 240,
        width: 180,
        height: 20,
        content: 'Date: {{system.date}}',
        fontSize: 12,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#666666',
        align: 'left',
        isVariable: true,
        dataField: 'system.date'
      },
      {
        type: 'text',
        x: 200,
        y: 240,
        width: 180,
        height: 20,
        content: 'User: {{system.user}}',
        fontSize: 12,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#666666',
        align: 'right',
        isVariable: true,
        dataField: 'system.user'
      }
    ]
  },
  {
    id: 'shipping-standard',
    name: 'Shipping Label',
    description: 'Standard 4x6 shipping label format',
    category: 'shipping',
    size: STANDARD_LABEL_SIZES.find(s => s.name === '4×6 Shipping')!,
    thumbnail: (
      <div className="w-full h-full bg-white border rounded p-2 space-y-2">
        <div className="border-b pb-1">
          <div className="text-xs font-bold">FROM: Company</div>
        </div>
        <div className="border-b pb-1">
          <div className="text-xs font-bold">TO: Customer</div>
        </div>
        <div className="h-8 bg-gray-200" />
      </div>
    ),
    elements: [
      {
        type: 'shape',
        x: 10,
        y: 10,
        width: 380,
        height: 580,
        shapeType: 'rectangle',
        stroke: '#000000',
        strokeWidth: 2,
        fill: 'transparent'
      },
      {
        type: 'text',
        x: 20,
        y: 20,
        width: 360,
        height: 30,
        content: 'SHIPPING LABEL',
        fontSize: 20,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        color: '#000000',
        align: 'center'
      },
      {
        type: 'line',
        x: 20,
        y: 60,
        x2: 380,
        y2: 60,
        width: 360,
        height: 2,
        stroke: '#000000',
        strokeWidth: 1
      }
    ]
  }
]

const categoryIcons = {
  location: MapPin,
  product: Package,
  shipping: Truck,
  pallet: Box,
}

export function LabelTemplates({ onSelectTemplate, currentSize }: LabelTemplatesProps) {
  const categories = Array.from(new Set(templates.map(t => t.category)))

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6">
        {categories.map(category => {
          const categoryTemplates = templates.filter(t => t.category === category)
          const Icon = categoryIcons[category]
          
          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-4">
                <Icon className="h-5 w-5" />
                <h3 className="text-lg font-semibold capitalize">{category} Labels</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryTemplates.map(template => (
                  <Card 
                    key={template.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => onSelectTemplate(
                      template.elements.map(el => ({ ...el, id: generateElementId() } as LabelElement)),
                      template.size
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {template.size.name}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="aspect-[3/2] bg-gray-50 rounded-md overflow-hidden">
                        {template.thumbnail}
                      </div>
                      <Button 
                        className="w-full mt-3"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectTemplate(
                            template.elements.map(el => ({ ...el, id: generateElementId() } as LabelElement)),
                            template.size
                          )
                        }}
                      >
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}