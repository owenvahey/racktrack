export type ElementType = 'text' | 'barcode' | 'qrcode' | 'image' | 'shape' | 'line'

export type FontWeight = 'normal' | 'medium' | 'semibold' | 'bold'
export type TextAlign = 'left' | 'center' | 'right'
export type ShapeType = 'rectangle' | 'circle' | 'rounded-rectangle'

export interface BaseElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  locked?: boolean
  visible?: boolean
}

export interface TextElement extends BaseElement {
  type: 'text'
  content: string
  fontSize: number
  fontFamily: string
  fontWeight: FontWeight
  color: string
  align: TextAlign
  lineHeight?: number
  letterSpacing?: number
  // For dynamic fields
  dataField?: string
  isVariable?: boolean
}

export interface BarcodeElement extends BaseElement {
  type: 'barcode'
  value: string
  format: 'CODE128' | 'CODE39' | 'EAN13' | 'UPC'
  showText: boolean
  textPosition: 'top' | 'bottom'
  // For dynamic data
  dataField?: string
  isVariable?: boolean
}

export interface QRCodeElement extends BaseElement {
  type: 'qrcode'
  value: string
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'
  // For dynamic data
  dataField?: string
  isVariable?: boolean
}

export interface ImageElement extends BaseElement {
  type: 'image'
  src: string
  objectFit: 'contain' | 'cover' | 'fill'
}

export interface ShapeElement extends BaseElement {
  type: 'shape'
  shapeType: ShapeType
  fill?: string
  stroke?: string
  strokeWidth?: number
  cornerRadius?: number // for rounded rectangle
}

export interface LineElement extends BaseElement {
  type: 'line'
  x2: number
  y2: number
  stroke: string
  strokeWidth: number
  strokeStyle?: 'solid' | 'dashed' | 'dotted'
}

export type LabelElement = TextElement | BarcodeElement | QRCodeElement | ImageElement | ShapeElement | LineElement

export interface LabelSize {
  name: string
  width: number  // in inches
  height: number // in inches
  category: 'shipping' | 'product' | 'location' | 'pallet' | 'custom'
}

export const STANDARD_LABEL_SIZES: LabelSize[] = [
  // Shipping Labels
  { name: '4×6 Shipping', width: 4, height: 6, category: 'shipping' },
  { name: '4×6¼ Shipping', width: 4, height: 6.25, category: 'shipping' },
  
  // Product Labels
  { name: '2×4 Product', width: 2, height: 4, category: 'product' },
  { name: '3×2 Product', width: 3, height: 2, category: 'product' },
  { name: '2×2 Square', width: 2, height: 2, category: 'product' },
  
  // Location Labels
  { name: '2×1 Small', width: 2, height: 1, category: 'location' },
  { name: '1×3 Narrow', width: 1, height: 3, category: 'location' },
  { name: '3×1 Wide', width: 3, height: 1, category: 'location' },
  
  // Pallet Labels
  { name: '4×4 Pallet', width: 4, height: 4, category: 'pallet' },
  { name: '4×6 Pallet', width: 4, height: 6, category: 'pallet' },
]

export interface LabelTemplate {
  id: string
  name: string
  description?: string
  category: string
  size: LabelSize
  elements: LabelElement[]
  thumbnail?: string
  createdAt: Date
  updatedAt: Date
}

// Available data fields for dynamic content
export interface DataField {
  key: string
  label: string
  category: 'location' | 'product' | 'pallet' | 'inventory' | 'system'
  example: string
}

export const AVAILABLE_DATA_FIELDS: DataField[] = [
  // Location fields
  { key: 'location.full', label: 'Full Location Code', category: 'location', example: 'WH01-A01-S01-01' },
  { key: 'location.warehouse', label: 'Warehouse Code', category: 'location', example: 'WH01' },
  { key: 'location.aisle', label: 'Aisle Code', category: 'location', example: 'A01' },
  { key: 'location.shelf', label: 'Shelf Code', category: 'location', example: 'S01' },
  { key: 'location.slot', label: 'Slot Code', category: 'location', example: '01' },
  { key: 'location.zone', label: 'Zone', category: 'location', example: 'Storage' },
  
  // Product fields
  { key: 'product.sku', label: 'Product SKU', category: 'product', example: 'SKU-12345' },
  { key: 'product.name', label: 'Product Name', category: 'product', example: 'Widget Pro Max' },
  { key: 'product.barcode', label: 'Product Barcode', category: 'product', example: '123456789012' },
  { key: 'product.category', label: 'Product Category', category: 'product', example: 'Electronics' },
  
  // Pallet fields
  { key: 'pallet.number', label: 'Pallet Number', category: 'pallet', example: 'PAL-20240115-001' },
  { key: 'pallet.status', label: 'Pallet Status', category: 'pallet', example: 'Stored' },
  { key: 'pallet.weight', label: 'Pallet Weight', category: 'pallet', example: '500 kg' },
  
  // Inventory fields
  { key: 'inventory.quantity', label: 'Quantity', category: 'inventory', example: '100' },
  { key: 'inventory.lot', label: 'Lot Number', category: 'inventory', example: 'LOT-2024-001' },
  { key: 'inventory.expiry', label: 'Expiry Date', category: 'inventory', example: '2025-12-31' },
  
  // System fields
  { key: 'system.date', label: 'Current Date', category: 'system', example: '2024-01-15' },
  { key: 'system.time', label: 'Current Time', category: 'system', example: '14:30' },
  { key: 'system.datetime', label: 'Date & Time', category: 'system', example: '2024-01-15 14:30' },
  { key: 'system.user', label: 'Current User', category: 'system', example: 'John Doe' },
]

// Helper functions
export function generateElementId(): string {
  return `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function inchesToPixels(inches: number, dpi: number = 203): number {
  // 203 DPI is standard for thermal printers
  return Math.round(inches * dpi)
}

export function pixelsToInches(pixels: number, dpi: number = 203): number {
  return pixels / dpi
}