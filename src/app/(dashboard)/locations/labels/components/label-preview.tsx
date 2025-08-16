'use client'

import { useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Printer,
  Download,
  FileText,
  Settings,
  Grid3x3
} from 'lucide-react'
import { 
  LabelElement, 
  LabelSize,
  inchesToPixels 
} from '../lib/label-elements'
import { labelToPrintFormat, replaceDataFields } from '../lib/label-utils'
const QRCode = require('qrcode.react')

interface LabelPreviewProps {
  size: LabelSize
  elements: LabelElement[]
  onPrint: () => void
}

// Sample data for preview
const SAMPLE_DATA = {
  location: {
    full: 'WH01-A01-S01-01',
    warehouse: 'WH01',
    aisle: 'A01',
    shelf: 'S01',
    slot: '01',
    zone: 'Storage'
  },
  product: {
    sku: 'SKU-12345',
    name: 'Sample Product',
    barcode: '123456789012',
    category: 'Electronics'
  },
  pallet: {
    number: 'PAL-20240115-001',
    status: 'Stored',
    weight: '500 kg'
  },
  inventory: {
    quantity: '100',
    lot: 'LOT-2024-001',
    expiry: '2025-12-31'
  },
  system: {
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    datetime: new Date().toLocaleString(),
    user: 'John Doe'
  }
}

export function LabelPreview({ size, elements, onPrint }: LabelPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [copies, setCopies] = useState(1)
  const [labelsPerRow, setLabelsPerRow] = useState(1)
  const [margin, setMargin] = useState(10)
  const [printDpi, setPrintDpi] = useState(203)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Label-${Date.now()}`,
    onAfterPrint: onPrint,
    pageStyle: `
      @page {
        size: auto;
        margin: 0;
      }
      @media print {
        body {
          margin: 0;
          padding: 0;
        }
      }
    `
  })

  const renderElement = (element: LabelElement, scale: number = 1) => {
    let processedElement = { ...element } as LabelElement
    
    // Replace data fields for text elements
    if (element.type === 'text' && element.isVariable && element.dataField) {
      processedElement = { ...element, content: replaceDataFields(`{{${element.dataField}}}`, SAMPLE_DATA) }
    } else if (element.type === 'text' && 'content' in element && element.content.includes('{{')) {
      processedElement = { ...element, content: replaceDataFields(element.content, SAMPLE_DATA) }
    }
    
    // Replace data fields for barcodes and QR codes
    if ((element.type === 'barcode' || element.type === 'qrcode') && element.isVariable && element.dataField) {
      const keys = element.dataField.split('.')
      let value: any = SAMPLE_DATA
      for (const key of keys) {
        value = value?.[key]
        if (value === undefined) break
      }
      if (value !== undefined) {
        processedElement = { ...element, value: String(value).replace(/[^a-zA-Z0-9]/g, '') }
      }
    }

    const scaledStyle = {
      position: 'absolute' as const,
      left: element.x * scale,
      top: element.y * scale,
      width: element.width * scale,
      height: element.height * scale,
    }

    switch (processedElement.type) {
      case 'text':
        return (
          <div
            style={{
              ...scaledStyle,
              fontSize: processedElement.fontSize * scale,
              fontFamily: processedElement.fontFamily,
              fontWeight: processedElement.fontWeight,
              color: processedElement.color,
              textAlign: processedElement.align,
              display: 'flex',
              alignItems: 'center',
              justifyContent: processedElement.align === 'center' ? 'center' : processedElement.align === 'right' ? 'flex-end' : 'flex-start',
              padding: 2 * scale,
            }}
          >
            {processedElement.content}
          </div>
        )

      case 'barcode':
        return (
          <div style={scaledStyle}>
            <svg
              width="100%"
              height={processedElement.showText ? '80%' : '100%'}
              viewBox="0 0 100 50"
              preserveAspectRatio="none"
            >
              {/* Simple barcode visualization */}
              {Array.from({ length: 30 }).map((_, i) => (
                <rect
                  key={i}
                  x={i * 3.33}
                  y={0}
                  width={i % 2 === 0 ? 2 : 1.5}
                  height={50}
                  fill="#000"
                />
              ))}
            </svg>
            {processedElement.showText && (
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 10 * scale,
                  fontFamily: 'monospace',
                  marginTop: 2 * scale,
                }}
              >
                {processedElement.value}
              </div>
            )}
          </div>
        )

      case 'qrcode':
        return (
          <div
            style={{
              ...scaledStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <QRCode
              value={processedElement.value}
              size={Math.min(element.width, element.height) * scale * 0.8}
              level={processedElement.errorCorrectionLevel}
            />
          </div>
        )

      case 'shape':
        if (element.type === 'shape' && element.shapeType === 'circle') {
          return (
            <svg style={scaledStyle}>
              <circle
                cx={(element.width * scale) / 2}
                cy={(element.height * scale) / 2}
                r={Math.min(element.width, element.height) * scale / 2 - (element.strokeWidth || 0) * scale / 2}
                fill={element.fill || 'transparent'}
                stroke={element.stroke}
                strokeWidth={(element.strokeWidth || 1) * scale}
              />
            </svg>
          )
        } else if (element.type === 'shape') {
          return (
            <div
              style={{
                ...scaledStyle,
                backgroundColor: element.fill || 'transparent',
                border: `${(element.strokeWidth || 1) * scale}px solid ${element.stroke || '#000'}`,
                borderRadius: element.shapeType === 'rounded-rectangle' 
                  ? (element.cornerRadius || 5) * scale 
                  : 0,
              }}
            />
          )
        }
        break

      case 'line':
        if (element.type === 'line') {
          return (
            <svg
              style={{
                position: 'absolute',
                left: Math.min(element.x, element.x2) * scale,
                top: Math.min(element.y, element.y2) * scale,
                width: Math.abs(element.x2 - element.x) * scale,
                height: Math.abs(element.y2 - element.y) * scale,
                pointerEvents: 'none',
              }}
            >
              <line
                x1={element.x < element.x2 ? 0 : Math.abs(element.x2 - element.x) * scale}
                y1={element.y < element.y2 ? 0 : Math.abs(element.y2 - element.y) * scale}
                x2={element.x2 > element.x ? Math.abs(element.x2 - element.x) * scale : 0}
                y2={element.y2 > element.y ? Math.abs(element.y2 - element.y) * scale : 0}
                stroke={element.stroke}
                strokeWidth={(element.strokeWidth || 1) * scale}
              />
            </svg>
          )
        }
        break

      case 'image':
        if (element.type === 'image') {
          return (
            <img
              src={element.src}
              alt=""
              style={{
                ...scaledStyle,
                objectFit: element.objectFit,
              }}
            />
          )
        }
        break

      default:
        return null
    }
  }

  const screenDpi = 96
  const scale = screenDpi / printDpi

  return (
    <div className="space-y-6">
      {/* Print Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Print Settings</CardTitle>
          <CardDescription>
            Configure print options for your labels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Number of Copies</Label>
              <Input
                type="number"
                value={copies}
                onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                min={1}
                max={100}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Labels per Row</Label>
              <Select
                value={labelsPerRow.toString()}
                onValueChange={(value) => setLabelsPerRow(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 (Thermal Printer)</SelectItem>
                  <SelectItem value="2">2 (Letter/A4)</SelectItem>
                  <SelectItem value="3">3 (Letter/A4)</SelectItem>
                  <SelectItem value="4">4 (Letter/A4)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Margin (px)</Label>
              <Input
                type="number"
                value={margin}
                onChange={(e) => setMargin(parseInt(e.target.value) || 0)}
                min={0}
                max={50}
              />
            </div>

            <div className="space-y-2">
              <Label>Print DPI</Label>
              <Select
                value={printDpi.toString()}
                onValueChange={(value) => setPrintDpi(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="203">203 DPI (Thermal)</SelectItem>
                  <SelectItem value="300">300 DPI (Thermal)</SelectItem>
                  <SelectItem value="600">600 DPI (Laser)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print Labels
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            This preview shows how your labels will appear when printed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto bg-gray-100 p-4 rounded-lg">
            <div
              ref={printRef}
              className="bg-white mx-auto"
              style={{
                width: 'fit-content',
                padding: margin,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${labelsPerRow}, 1fr)`,
                  gap: margin,
                }}
              >
                {Array.from({ length: copies }).map((_, copyIndex) => (
                  <div
                    key={copyIndex}
                    className="relative bg-white"
                    style={{
                      width: inchesToPixels(size.width, screenDpi),
                      height: inchesToPixels(size.height, screenDpi),
                      border: '1px solid #ddd',
                    }}
                  >
                    {elements.map((element) => (
                      <div key={element.id}>
                        {renderElement(element, scale)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}