'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Trash2, 
  Copy, 
  Lock, 
  Unlock,
  Variable,
  Type,
  Palette,
  Move,
  Square,
  BarChart
} from 'lucide-react'
import { 
  LabelElement,
  TextElement,
  BarcodeElement,
  QRCodeElement,
  ImageElement,
  ShapeElement,
  LineElement,
  AVAILABLE_DATA_FIELDS
} from '../lib/label-elements'

interface LabelPropertiesProps {
  element?: LabelElement
  onUpdate: (updates: Partial<LabelElement>) => void
  onDelete: () => void
  onDuplicate: () => void
}

export function LabelProperties({
  element,
  onUpdate,
  onDelete,
  onDuplicate,
}: LabelPropertiesProps) {
  if (!element) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <Square className="h-12 w-12 mx-auto mb-2" />
          <p>Select an element to view properties</p>
        </div>
      </div>
    )
  }

  const renderTextProperties = (el: TextElement) => (
    <>
      <div className="space-y-2">
        <Label>Content</Label>
        {el.isVariable ? (
          <Select
            value={el.dataField || ''}
            onValueChange={(value) => onUpdate({ dataField: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select data field" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_DATA_FIELDS.map(field => (
                <SelectItem key={field.key} value={field.key}>
                  <div>
                    <div className="font-medium">{field.label}</div>
                    <div className="text-xs text-muted-foreground">{field.example}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Textarea
            value={el.content}
            onChange={(e) => onUpdate({ content: e.target.value })}
            rows={3}
          />
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="variable"
          checked={el.isVariable || false}
          onCheckedChange={(checked) => onUpdate({ isVariable: checked })}
        />
        <Label htmlFor="variable" className="cursor-pointer">
          Use dynamic data
        </Label>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Font Size</Label>
          <Input
            type="number"
            value={el.fontSize}
            onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) || 12 })}
            min={6}
            max={72}
          />
        </div>
        <div className="space-y-2">
          <Label>Font Weight</Label>
          <Select
            value={el.fontWeight}
            onValueChange={(value) => onUpdate({ fontWeight: value as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="semibold">Semibold</SelectItem>
              <SelectItem value="bold">Bold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Text Align</Label>
        <Select
          value={el.align}
          onValueChange={(value) => onUpdate({ align: value as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={el.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="w-16 h-9 p-1"
          />
          <Input
            value={el.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
            placeholder="#000000"
          />
        </div>
      </div>
    </>
  )

  const renderBarcodeProperties = (el: BarcodeElement) => (
    <>
      <div className="space-y-2">
        <Label>Value</Label>
        {el.isVariable ? (
          <Select
            value={el.dataField || ''}
            onValueChange={(value) => onUpdate({ dataField: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select data field" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_DATA_FIELDS.filter(f => 
                ['product.barcode', 'product.sku', 'pallet.number'].includes(f.key)
              ).map(field => (
                <SelectItem key={field.key} value={field.key}>
                  <div>
                    <div className="font-medium">{field.label}</div>
                    <div className="text-xs text-muted-foreground">{field.example}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={el.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="123456789"
          />
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="variable"
          checked={el.isVariable || false}
          onCheckedChange={(checked) => onUpdate({ isVariable: checked })}
        />
        <Label htmlFor="variable" className="cursor-pointer">
          Use dynamic data
        </Label>
      </div>

      <div className="space-y-2">
        <Label>Format</Label>
        <Select
          value={el.format}
          onValueChange={(value) => onUpdate({ format: value as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CODE128">Code 128</SelectItem>
            <SelectItem value="CODE39">Code 39</SelectItem>
            <SelectItem value="EAN13">EAN-13</SelectItem>
            <SelectItem value="UPC">UPC</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="showText"
          checked={el.showText}
          onCheckedChange={(checked) => onUpdate({ showText: checked })}
        />
        <Label htmlFor="showText" className="cursor-pointer">
          Show text
        </Label>
      </div>
    </>
  )

  const renderQRCodeProperties = (el: QRCodeElement) => (
    <>
      <div className="space-y-2">
        <Label>Value</Label>
        {el.isVariable ? (
          <Select
            value={el.dataField || ''}
            onValueChange={(value) => onUpdate({ dataField: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select data field" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_DATA_FIELDS.map(field => (
                <SelectItem key={field.key} value={field.key}>
                  <div>
                    <div className="font-medium">{field.label}</div>
                    <div className="text-xs text-muted-foreground">{field.example}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Textarea
            value={el.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="https://example.com"
            rows={3}
          />
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="variable"
          checked={el.isVariable || false}
          onCheckedChange={(checked) => onUpdate({ isVariable: checked })}
        />
        <Label htmlFor="variable" className="cursor-pointer">
          Use dynamic data
        </Label>
      </div>

      <div className="space-y-2">
        <Label>Error Correction</Label>
        <Select
          value={el.errorCorrectionLevel}
          onValueChange={(value) => onUpdate({ errorCorrectionLevel: value as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="L">Low (7%)</SelectItem>
            <SelectItem value="M">Medium (15%)</SelectItem>
            <SelectItem value="Q">Quartile (25%)</SelectItem>
            <SelectItem value="H">High (30%)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  )

  const renderShapeProperties = (el: ShapeElement) => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fill Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={el.fill || '#ffffff'}
              onChange={(e) => onUpdate({ fill: e.target.value })}
              className="w-12 h-9 p-1"
            />
            <Input
              value={el.fill || ''}
              onChange={(e) => onUpdate({ fill: e.target.value })}
              placeholder="transparent"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Stroke Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={el.stroke || '#000000'}
              onChange={(e) => onUpdate({ stroke: e.target.value })}
              className="w-12 h-9 p-1"
            />
            <Input
              value={el.stroke || ''}
              onChange={(e) => onUpdate({ stroke: e.target.value })}
              placeholder="#000000"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Stroke Width</Label>
        <Input
          type="number"
          value={el.strokeWidth || 1}
          onChange={(e) => onUpdate({ strokeWidth: parseInt(e.target.value) || 1 })}
          min={0}
          max={20}
        />
      </div>

      {el.shapeType === 'rounded-rectangle' && (
        <div className="space-y-2">
          <Label>Corner Radius</Label>
          <Input
            type="number"
            value={el.cornerRadius || 5}
            onChange={(e) => onUpdate({ cornerRadius: parseInt(e.target.value) || 0 })}
            min={0}
            max={50}
          />
        </div>
      )}
    </>
  )

  const renderPositionProperties = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>X Position</Label>
          <Input
            type="number"
            value={Math.round(element.x)}
            onChange={(e) => onUpdate({ x: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Y Position</Label>
          <Input
            type="number"
            value={Math.round(element.y)}
            onChange={(e) => onUpdate({ y: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Width</Label>
          <Input
            type="number"
            value={Math.round(element.width)}
            onChange={(e) => onUpdate({ width: parseInt(e.target.value) || 1 })}
            min={1}
          />
        </div>
        <div className="space-y-2">
          <Label>Height</Label>
          <Input
            type="number"
            value={Math.round(element.height)}
            onChange={(e) => onUpdate({ height: parseInt(e.target.value) || 1 })}
            min={1}
          />
        </div>
      </div>
    </>
  )

  const getElementIcon = () => {
    switch (element.type) {
      case 'text': return Type
      case 'barcode': return BarChart
      case 'qrcode': return Square
      case 'shape': return Square
      case 'line': return Move
      case 'image': return Square
      default: return Square
    }
  }

  const Icon = getElementIcon()

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            <h3 className="font-semibold capitalize">{element.type} Properties</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onDuplicate}
              title="Duplicate"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onUpdate({ locked: !element.locked })}
              title={element.locked ? 'Unlock' : 'Lock'}
            >
              {element.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Element-specific properties */}
        <Accordion type="single" collapsible defaultValue="content">
          <AccordionItem value="content">
            <AccordionTrigger>Content</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {element.type === 'text' && renderTextProperties(element)}
                {element.type === 'barcode' && renderBarcodeProperties(element)}
                {element.type === 'qrcode' && renderQRCodeProperties(element)}
                {element.type === 'shape' && renderShapeProperties(element)}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="position">
            <AccordionTrigger>Position & Size</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {renderPositionProperties()}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </ScrollArea>
  )
}