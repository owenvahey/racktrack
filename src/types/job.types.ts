export interface Job {
  id: string
  job_number: string
  po_id?: string
  customer_id?: string
  job_name: string
  description?: string
  status: 'created' | 'planned' | 'in_progress' | 'review' | 'completed' | 'shipped' | 'cancelled'
  priority: number
  estimated_start_date?: string
  estimated_completion_date?: string
  actual_start_date?: string
  actual_completion_date?: string
  assigned_to?: string
  work_center?: string
  estimated_hours?: number
  estimated_cost?: number
  actual_hours: number
  actual_cost: number
  progress_percentage: number
  production_notes?: string
  quality_requirements?: string
  special_instructions?: string
  customer_approved: boolean
  customer_approval_date?: string
  proof_required: boolean
  proof_approved: boolean
  created_at: string
  updated_at: string
  // Relations
  purchase_order?: any
  customer?: any
  assigned_user?: any
  line_items?: JobLineItem[]
  activities?: JobActivity[]
}

export interface JobLineItem {
  id: string
  job_id: string
  po_line_item_id?: string
  quantity_ordered: number
  quantity_completed: number
  quantity_shipped: number
  inventory_allocated?: Array<{
    inventory_id: string
    quantity: number
  }>
  inventory_consumed?: Array<{
    inventory_id: string
    quantity: number
  }>
  status: 'pending' | 'in_progress' | 'completed' | 'shipped'
  production_started_at?: string
  production_completed_at?: string
  shipped_at?: string
  quality_approved: boolean
  quality_notes?: string
  created_at: string
  updated_at: string
  // Relations
  po_line_item?: any
}

export interface JobActivity {
  id: string
  job_id: string
  activity_type: string
  description: string
  old_value?: string
  new_value?: string
  performed_by?: string
  created_at: string
  // Relations
  user?: any
}

export interface Invoice {
  id: string
  invoice_number: string
  qb_invoice_id?: string
  qb_sync_token?: string
  job_id?: string
  po_id?: string
  customer_id: string
  invoice_date: string
  due_date?: string
  subtotal: number
  tax_rate?: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'void'
  amount_paid: number
  balance_due: number
  qb_doc_number?: string
  qb_private_note?: string
  qb_customer_memo?: string
  shipping_date?: string
  tracking_number?: string
  shipping_method?: string
  qb_created_time?: string
  qb_last_updated_time?: string
  sent_to_qb_at?: string
  created_at: string
  updated_at: string
  // Relations
  job?: Job
  purchase_order?: any
  customer?: any
  line_items?: InvoiceLineItem[]
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  job_line_item_id?: string
  line_number: number
  description: string
  quantity: number
  unit_price: number
  line_total: number
  qb_item_id?: string
  created_at: string
}