export interface QBConnection {
  id: string
  company_id: string
  company_name?: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  realm_id: string
  base_url: string
  sync_enabled: boolean
  last_sync_at?: string
  sync_frequency_hours: number
  last_error?: string
  error_count: number
  created_at: string
  updated_at: string
}

export interface QBSyncStatus {
  id: string
  connection_id: string
  sync_type: 'customers' | 'items' | 'purchase_orders' | 'invoices'
  last_sync_token?: string
  last_sync_at?: string
  next_sync_at?: string
  sync_status: 'success' | 'error' | 'in_progress'
  error_message?: string
  records_synced: number
  created_at: string
  updated_at: string
}

export interface QBCustomer {
  id: string
  qb_customer_id: string
  qb_sync_token?: string
  name: string
  display_name?: string
  company_name?: string
  email?: string
  phone?: string
  mobile?: string
  fax?: string
  website?: string
  billing_address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
  shipping_address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
  payment_terms?: string
  credit_limit?: number
  tax_exempt: boolean
  is_active: boolean
  preferred_delivery_method?: string
  qb_created_time?: string
  qb_last_updated_time?: string
  last_synced_at: string
  created_at: string
  updated_at: string
}

export interface QBItem {
  id: string
  qb_item_id: string
  qb_sync_token?: string
  name: string
  sku?: string
  description?: string
  type?: 'Inventory' | 'NonInventory' | 'Service'
  unit_price?: number
  income_account_ref?: string
  expense_account_ref?: string
  track_quantity: boolean
  quantity_on_hand?: number
  is_active: boolean
  qb_created_time?: string
  qb_last_updated_time?: string
  last_synced_at: string
  created_at: string
  updated_at: string
}

export interface PurchaseOrder {
  id: string
  po_number: string
  qb_po_id?: string
  qb_estimate_id?: string
  qb_sync_token?: string
  customer_id?: string
  customer_name: string
  status: 'draft' | 'pending' | 'approved' | 'in_progress' | 'completed' | 'shipped' | 'cancelled'
  po_date: string
  due_date?: string
  ship_date?: string
  billing_address?: any
  shipping_address?: any
  subtotal: number
  tax_amount: number
  discount_amount: number
  shipping_amount: number
  total_amount: number
  payment_terms?: string
  shipping_terms?: string
  customer_notes?: string
  internal_notes?: string
  special_instructions?: string
  priority: number
  rush_order: boolean
  qb_created_time?: string
  qb_last_updated_time?: string
  last_synced_at?: string
  created_at: string
  updated_at: string
  // Relations
  customer?: QBCustomer
  line_items?: POLineItem[]
}

export interface POLineItem {
  id: string
  po_id: string
  line_number: number
  product_id?: string
  qb_item_id?: string
  item_name: string
  description?: string
  sku?: string
  quantity: number
  unit_of_measure: string
  unit_price: number
  line_total: number
  print_specifications?: {
    colors?: string[]
    locations?: string[]
    artwork_url?: string
    [key: string]: any
  }
  estimated_production_hours?: number
  special_instructions?: string
  created_at: string
  updated_at: string
}