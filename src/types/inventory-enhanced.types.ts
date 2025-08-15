// Enhanced Inventory Types with Case-Level Tracking

export interface ProductWithCaseInfo {
  id: string
  sku: string
  name: string
  description?: string
  category?: string
  subcategory?: string
  unit_of_measure: string
  units_per_case: number
  case_weight_kg?: number
  case_dimensions?: {
    length: number
    width: number
    height: number
    unit: 'cm' | 'in'
  }
  case_barcode_prefix?: string
  packaging_type?: 'box' | 'bag' | 'bottle' | 'can' | 'jar' | 'drum' | 'pail' | 'roll' | 'sheet' | 'other'
  weight_per_unit?: number
  cost_per_unit?: number
  sell_price?: number
  barcode?: string
  min_stock_level: number
  max_stock_level?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PalletContent {
  id: string
  pallet_id: string
  product_id: string
  // Initial quantities
  case_count: number
  units_per_case: number
  total_units: number // calculated: case_count * units_per_case
  // Remaining quantities (tracks consumption)
  cases_remaining: number
  loose_units_remaining: number
  total_units_remaining: number // calculated: (cases_remaining * units_per_case) + loose_units_remaining
  // Tracking
  lot_number?: string
  expiration_date?: string
  received_date: string
  quality_status: 'pending' | 'approved' | 'rejected' | 'quarantine'
  unit_cost?: number
  notes?: string
  created_at: string
  updated_at: string
  // Relations
  pallet?: any
  product?: ProductWithCaseInfo
}

export interface PalletLabel {
  id: string
  pallet_id: string
  label_code: string // barcode value
  label_type: 'master' | 'case' | 'unit'
  content_summary: {
    pallet_number: string
    location?: string
    received_date: string
    total_products: number
    total_cases: number
    total_units: number
    contents: Array<{
      product_name: string
      product_sku: string
      case_count: number
      units_per_case: number
      total_units: number
      lot_number?: string
    }>
  }
  printed_at: string
  printed_by?: string
  printer_name?: string
  is_active: boolean
  voided_at?: string
  voided_by?: string
  void_reason?: string
  created_at: string
}

export interface InventoryConsumption {
  id: string
  pallet_content_id: string
  consumed_cases: number
  consumed_units: number // individual units not from full cases
  total_consumed_units: number // calculated
  units_per_case: number
  consumption_type: 'full_case' | 'partial_case' | 'individual' | 'mixed'
  job_route_id?: string
  job_material_consumption_id?: string
  consumed_by?: string
  consumed_at: string
  notes?: string
  device_info?: any
  // Relations
  pallet_content?: PalletContent
}

export interface ReceivingSession {
  id: string
  session_number: string
  started_at: string
  completed_at?: string
  status: 'open' | 'completed' | 'cancelled'
  po_reference?: string
  supplier_name?: string
  supplier_info?: any
  received_by?: string
  total_pallets: number
  total_products: number
  total_cases: number
  total_units: number
  notes?: string
  created_at: string
  updated_at: string
  // Relations
  receiving_items?: ReceivingItem[]
}

export interface ReceivingItem {
  id: string
  session_id: string
  pallet_id: string
  product_id: string
  cases_received: number
  units_per_case: number
  total_units_received: number // calculated
  quality_check_status: 'pending' | 'passed' | 'failed' | 'partial'
  quality_notes?: string
  created_at: string
  // Relations
  product?: ProductWithCaseInfo
  pallet?: any
}

// Helper types for UI

export interface PalletWithContents {
  id: string
  pallet_number: string
  status: string
  current_location_id?: string
  contents: (PalletContent & { product: ProductWithCaseInfo })[]
  total_products: number
  total_cases: number
  total_units: number
  created_at: string
}

export interface ConsumptionRequest {
  pallet_content_id: string
  cases_to_consume: number
  units_to_consume: number // individual units
  notes?: string
  job_route_id?: string
}

export interface InventoryDisplay {
  product: ProductWithCaseInfo
  by_location: Array<{
    pallet: any
    pallet_content: PalletContent
    location?: any
  }>
  total_cases: number
  total_loose_units: number
  total_units: number
  // Display helpers
  display_quantity: string // e.g. "12 cases + 45 units"
  display_total: string // e.g. "1,245 units total"
}

// Form types

export interface ReceivingFormData {
  po_reference?: string
  supplier_name?: string
  items: Array<{
    product_id: string
    cases_received: number
    units_per_case_override?: number // if different from product default
    lot_number?: string
    expiration_date?: string
  }>
}

export interface ConsumptionFormData {
  consumption_method: 'cases' | 'units' | 'both'
  cases: number
  units: number
  notes?: string
}

// Utility functions for display

export function formatInventoryDisplay(cases: number, loose_units: number, units_per_case: number): string {
  if (cases === 0 && loose_units === 0) return '0 units'
  if (cases === 0) return `${loose_units} units`
  if (loose_units === 0) return `${cases} cases (${cases * units_per_case} units)`
  return `${cases} cases + ${loose_units} units (${cases * units_per_case + loose_units} total)`
}

export function calculateTotalUnits(cases: number, units: number, units_per_case: number): number {
  return (cases * units_per_case) + units
}

export function convertUnitsToMixed(total_units: number, units_per_case: number): { cases: number, units: number } {
  const cases = Math.floor(total_units / units_per_case)
  const units = total_units % units_per_case
  return { cases, units }
}