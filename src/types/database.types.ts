export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'admin' | 'manager' | 'worker' | 'viewer'
          warehouse_id: string | null
          phone: string | null
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'admin' | 'manager' | 'worker' | 'viewer'
          warehouse_id?: string | null
          phone?: string | null
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'admin' | 'manager' | 'worker' | 'viewer'
          warehouse_id?: string | null
          phone?: string | null
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      warehouses: {
        Row: {
          id: string
          name: string
          code: string
          address: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          sku: string
          name: string
          description: string | null
          category: string | null
          subcategory: string | null
          unit_of_measure: string
          weight_per_unit: number | null
          dimensions: Json | null
          cost_per_unit: number | null
          sell_price: number | null
          barcode: string | null
          qb_item_id: string | null
          min_stock_level: number
          max_stock_level: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          name: string
          description?: string | null
          category?: string | null
          subcategory?: string | null
          unit_of_measure?: string
          weight_per_unit?: number | null
          dimensions?: Json | null
          cost_per_unit?: number | null
          sell_price?: number | null
          barcode?: string | null
          qb_item_id?: string | null
          min_stock_level?: number
          max_stock_level?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          name?: string
          description?: string | null
          category?: string | null
          subcategory?: string | null
          unit_of_measure?: string
          weight_per_unit?: number | null
          dimensions?: Json | null
          cost_per_unit?: number | null
          sell_price?: number | null
          barcode?: string | null
          qb_item_id?: string | null
          min_stock_level?: number
          max_stock_level?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      aisles: {
        Row: {
          id: string
          warehouse_id: string
          code: string
          name: string | null
          description: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          warehouse_id: string
          code: string
          name?: string | null
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          warehouse_id?: string
          code?: string
          name?: string | null
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      shelves: {
        Row: {
          id: string
          aisle_id: string
          code: string
          level_number: number | null
          height_cm: number | null
          weight_capacity_kg: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          aisle_id: string
          code: string
          level_number?: number | null
          height_cm?: number | null
          weight_capacity_kg?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          aisle_id?: string
          code?: string
          level_number?: number | null
          height_cm?: number | null
          weight_capacity_kg?: number | null
          is_active?: boolean
          created_at?: string
        }
      }
      storage_slots: {
        Row: {
          id: string
          shelf_id: string
          code: string
          position_number: number | null
          length_cm: number | null
          width_cm: number | null
          height_cm: number | null
          weight_capacity_kg: number | null
          is_occupied: boolean
          current_pallet_id: string | null
          zone: string | null
          temperature_controlled: boolean
          hazmat_approved: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          shelf_id: string
          code: string
          position_number?: number | null
          length_cm?: number | null
          width_cm?: number | null
          height_cm?: number | null
          weight_capacity_kg?: number | null
          is_occupied?: boolean
          current_pallet_id?: string | null
          zone?: string | null
          temperature_controlled?: boolean
          hazmat_approved?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          shelf_id?: string
          code?: string
          position_number?: number | null
          length_cm?: number | null
          width_cm?: number | null
          height_cm?: number | null
          weight_capacity_kg?: number | null
          is_occupied?: boolean
          current_pallet_id?: string | null
          zone?: string | null
          temperature_controlled?: boolean
          hazmat_approved?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      pallets: {
        Row: {
          id: string
          pallet_number: string
          current_location_id: string | null
          previous_location_id: string | null
          status: 'receiving' | 'in_transit' | 'stored' | 'picking' | 'staged' | 'shipped'
          pallet_type: string
          max_weight_kg: number | null
          max_height_cm: number | null
          current_weight_kg: number | null
          current_height_cm: number | null
          qr_code: string | null
          received_date: string | null
          last_moved: string | null
          created_by: string | null
          notes: string | null
          special_handling: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pallet_number?: string
          current_location_id?: string | null
          previous_location_id?: string | null
          status?: 'receiving' | 'in_transit' | 'stored' | 'picking' | 'staged' | 'shipped'
          pallet_type?: string
          max_weight_kg?: number | null
          max_height_cm?: number | null
          current_weight_kg?: number | null
          current_height_cm?: number | null
          qr_code?: string | null
          received_date?: string | null
          last_moved?: string | null
          created_by?: string | null
          notes?: string | null
          special_handling?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pallet_number?: string
          current_location_id?: string | null
          previous_location_id?: string | null
          status?: 'receiving' | 'in_transit' | 'stored' | 'picking' | 'staged' | 'shipped'
          pallet_type?: string
          max_weight_kg?: number | null
          max_height_cm?: number | null
          current_weight_kg?: number | null
          current_height_cm?: number | null
          qr_code?: string | null
          received_date?: string | null
          last_moved?: string | null
          created_by?: string | null
          notes?: string | null
          special_handling?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      inventory: {
        Row: {
          id: string
          product_id: string
          pallet_id: string
          quantity: number
          reserved_quantity: number
          available_quantity: number
          lot_number: string | null
          batch_number: string | null
          serial_numbers: string[] | null
          manufactured_date: string | null
          expiration_date: string | null
          received_date: string
          unit_cost: number | null
          total_cost: number | null
          quality_status: 'pending' | 'approved' | 'rejected' | 'quarantine'
          quality_notes: string | null
          quality_checked_by: string | null
          quality_checked_at: string | null
          supplier_info: Json | null
          custom_fields: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          pallet_id: string
          quantity: number
          reserved_quantity?: number
          lot_number?: string | null
          batch_number?: string | null
          serial_numbers?: string[] | null
          manufactured_date?: string | null
          expiration_date?: string | null
          received_date?: string
          unit_cost?: number | null
          quality_status?: 'pending' | 'approved' | 'rejected' | 'quarantine'
          quality_notes?: string | null
          quality_checked_by?: string | null
          quality_checked_at?: string | null
          supplier_info?: Json | null
          custom_fields?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          pallet_id?: string
          quantity?: number
          reserved_quantity?: number
          lot_number?: string | null
          batch_number?: string | null
          serial_numbers?: string[] | null
          manufactured_date?: string | null
          expiration_date?: string | null
          received_date?: string
          unit_cost?: number | null
          quality_status?: 'pending' | 'approved' | 'rejected' | 'quarantine'
          quality_notes?: string | null
          quality_checked_by?: string | null
          quality_checked_at?: string | null
          supplier_info?: Json | null
          custom_fields?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      inventory_movements: {
        Row: {
          id: string
          inventory_id: string | null
          pallet_id: string | null
          movement_type: 'receive' | 'move' | 'pick' | 'ship' | 'adjust' | 'transfer' | 'return'
          quantity_before: number | null
          quantity_change: number | null
          quantity_after: number | null
          from_location_id: string | null
          to_location_id: string | null
          reference_type: string | null
          reference_id: string | null
          reference_number: string | null
          performed_by: string
          device_info: Json | null
          reason: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          inventory_id?: string | null
          pallet_id?: string | null
          movement_type: 'receive' | 'move' | 'pick' | 'ship' | 'adjust' | 'transfer' | 'return'
          quantity_before?: number | null
          quantity_change?: number | null
          quantity_after?: number | null
          from_location_id?: string | null
          to_location_id?: string | null
          reference_type?: string | null
          reference_id?: string | null
          reference_number?: string | null
          performed_by: string
          device_info?: Json | null
          reason?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          inventory_id?: string | null
          pallet_id?: string | null
          movement_type?: 'receive' | 'move' | 'pick' | 'ship' | 'adjust' | 'transfer' | 'return'
          quantity_before?: number | null
          quantity_change?: number | null
          quantity_after?: number | null
          from_location_id?: string | null
          to_location_id?: string | null
          reference_type?: string | null
          reference_id?: string | null
          reference_number?: string | null
          performed_by?: string
          device_info?: Json | null
          reason?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      qb_connections: {
        Row: {
          id: string
          company_id: string
          company_name: string | null
          access_token: string
          refresh_token: string
          token_expires_at: string
          realm_id: string
          base_url: string
          sync_enabled: boolean
          last_sync_at: string | null
          sync_frequency_hours: number
          last_error: string | null
          error_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          company_name?: string | null
          access_token: string
          refresh_token: string
          token_expires_at: string
          realm_id: string
          base_url: string
          sync_enabled?: boolean
          last_sync_at?: string | null
          sync_frequency_hours?: number
          last_error?: string | null
          error_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          company_name?: string | null
          access_token?: string
          refresh_token?: string
          token_expires_at?: string
          realm_id?: string
          base_url?: string
          sync_enabled?: boolean
          last_sync_at?: string | null
          sync_frequency_hours?: number
          last_error?: string | null
          error_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      qb_customers: {
        Row: {
          id: string
          qb_customer_id: string
          qb_sync_token: string | null
          name: string
          display_name: string | null
          company_name: string | null
          email: string | null
          phone: string | null
          mobile: string | null
          fax: string | null
          website: string | null
          billing_address: Json | null
          shipping_address: Json | null
          payment_terms: string | null
          credit_limit: number | null
          tax_exempt: boolean
          is_active: boolean
          preferred_delivery_method: string | null
          qb_created_time: string | null
          qb_last_updated_time: string | null
          last_synced_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          qb_customer_id: string
          qb_sync_token?: string | null
          name: string
          display_name?: string | null
          company_name?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          fax?: string | null
          website?: string | null
          billing_address?: Json | null
          shipping_address?: Json | null
          payment_terms?: string | null
          credit_limit?: number | null
          tax_exempt?: boolean
          is_active?: boolean
          preferred_delivery_method?: string | null
          qb_created_time?: string | null
          qb_last_updated_time?: string | null
          last_synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          qb_customer_id?: string
          qb_sync_token?: string | null
          name?: string
          display_name?: string | null
          company_name?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          fax?: string | null
          website?: string | null
          billing_address?: Json | null
          shipping_address?: Json | null
          payment_terms?: string | null
          credit_limit?: number | null
          tax_exempt?: boolean
          is_active?: boolean
          preferred_delivery_method?: string | null
          qb_created_time?: string | null
          qb_last_updated_time?: string | null
          last_synced_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      purchase_orders: {
        Row: {
          id: string
          po_number: string
          qb_po_id: string | null
          qb_estimate_id: string | null
          qb_sync_token: string | null
          customer_id: string | null
          customer_name: string
          status: 'draft' | 'pending' | 'approved' | 'in_progress' | 'completed' | 'shipped' | 'cancelled'
          po_date: string
          due_date: string | null
          ship_date: string | null
          billing_address: Json | null
          shipping_address: Json | null
          subtotal: number
          tax_amount: number
          discount_amount: number
          shipping_amount: number
          total_amount: number
          payment_terms: string | null
          shipping_terms: string | null
          customer_notes: string | null
          internal_notes: string | null
          special_instructions: string | null
          priority: number
          rush_order: boolean
          qb_created_time: string | null
          qb_last_updated_time: string | null
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          po_number: string
          qb_po_id?: string | null
          qb_estimate_id?: string | null
          qb_sync_token?: string | null
          customer_id?: string | null
          customer_name: string
          status?: 'draft' | 'pending' | 'approved' | 'in_progress' | 'completed' | 'shipped' | 'cancelled'
          po_date: string
          due_date?: string | null
          ship_date?: string | null
          billing_address?: Json | null
          shipping_address?: Json | null
          subtotal?: number
          tax_amount?: number
          discount_amount?: number
          shipping_amount?: number
          total_amount?: number
          payment_terms?: string | null
          shipping_terms?: string | null
          customer_notes?: string | null
          internal_notes?: string | null
          special_instructions?: string | null
          priority?: number
          rush_order?: boolean
          qb_created_time?: string | null
          qb_last_updated_time?: string | null
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          po_number?: string
          qb_po_id?: string | null
          qb_estimate_id?: string | null
          qb_sync_token?: string | null
          customer_id?: string | null
          customer_name?: string
          status?: 'draft' | 'pending' | 'approved' | 'in_progress' | 'completed' | 'shipped' | 'cancelled'
          po_date?: string
          due_date?: string | null
          ship_date?: string | null
          billing_address?: Json | null
          shipping_address?: Json | null
          subtotal?: number
          tax_amount?: number
          discount_amount?: number
          shipping_amount?: number
          total_amount?: number
          payment_terms?: string | null
          shipping_terms?: string | null
          customer_notes?: string | null
          internal_notes?: string | null
          special_instructions?: string | null
          priority?: number
          rush_order?: boolean
          qb_created_time?: string | null
          qb_last_updated_time?: string | null
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          job_number: string
          po_id: string | null
          customer_id: string | null
          job_name: string
          description: string | null
          status: 'created' | 'planned' | 'in_progress' | 'review' | 'completed' | 'shipped' | 'cancelled'
          priority: number
          estimated_start_date: string | null
          estimated_completion_date: string | null
          actual_start_date: string | null
          actual_completion_date: string | null
          assigned_to: string | null
          work_center: string | null
          estimated_hours: number | null
          estimated_cost: number | null
          actual_hours: number
          actual_cost: number
          progress_percentage: number
          production_notes: string | null
          quality_requirements: string | null
          special_instructions: string | null
          customer_approved: boolean
          customer_approval_date: string | null
          proof_required: boolean
          proof_approved: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_number?: string
          po_id?: string | null
          customer_id?: string | null
          job_name: string
          description?: string | null
          status?: 'created' | 'planned' | 'in_progress' | 'review' | 'completed' | 'shipped' | 'cancelled'
          priority?: number
          estimated_start_date?: string | null
          estimated_completion_date?: string | null
          actual_start_date?: string | null
          actual_completion_date?: string | null
          assigned_to?: string | null
          work_center?: string | null
          estimated_hours?: number | null
          estimated_cost?: number | null
          actual_hours?: number
          actual_cost?: number
          progress_percentage?: number
          production_notes?: string | null
          quality_requirements?: string | null
          special_instructions?: string | null
          customer_approved?: boolean
          customer_approval_date?: string | null
          proof_required?: boolean
          proof_approved?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_number?: string
          po_id?: string | null
          customer_id?: string | null
          job_name?: string
          description?: string | null
          status?: 'created' | 'planned' | 'in_progress' | 'review' | 'completed' | 'shipped' | 'cancelled'
          priority?: number
          estimated_start_date?: string | null
          estimated_completion_date?: string | null
          actual_start_date?: string | null
          actual_completion_date?: string | null
          assigned_to?: string | null
          work_center?: string | null
          estimated_hours?: number | null
          estimated_cost?: number | null
          actual_hours?: number
          actual_cost?: number
          progress_percentage?: number
          production_notes?: string | null
          quality_requirements?: string | null
          special_instructions?: string | null
          customer_approved?: boolean
          customer_approval_date?: string | null
          proof_required?: boolean
          proof_approved?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          qb_invoice_id: string | null
          qb_sync_token: string | null
          job_id: string | null
          po_id: string | null
          customer_id: string
          invoice_date: string
          due_date: string | null
          subtotal: number
          tax_rate: number | null
          tax_amount: number
          discount_amount: number
          total_amount: number
          status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'void'
          amount_paid: number
          balance_due: number
          qb_doc_number: string | null
          qb_private_note: string | null
          qb_customer_memo: string | null
          shipping_date: string | null
          tracking_number: string | null
          shipping_method: string | null
          qb_created_time: string | null
          qb_last_updated_time: string | null
          sent_to_qb_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number?: string
          qb_invoice_id?: string | null
          qb_sync_token?: string | null
          job_id?: string | null
          po_id?: string | null
          customer_id: string
          invoice_date?: string
          due_date?: string | null
          subtotal?: number
          tax_rate?: number | null
          tax_amount?: number
          discount_amount?: number
          total_amount?: number
          status?: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'void'
          amount_paid?: number
          qb_doc_number?: string | null
          qb_private_note?: string | null
          qb_customer_memo?: string | null
          shipping_date?: string | null
          tracking_number?: string | null
          shipping_method?: string | null
          qb_created_time?: string | null
          qb_last_updated_time?: string | null
          sent_to_qb_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          qb_invoice_id?: string | null
          qb_sync_token?: string | null
          job_id?: string | null
          po_id?: string | null
          customer_id?: string
          invoice_date?: string
          due_date?: string | null
          subtotal?: number
          tax_rate?: number | null
          tax_amount?: number
          discount_amount?: number
          total_amount?: number
          status?: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'void'
          amount_paid?: number
          qb_doc_number?: string | null
          qb_private_note?: string | null
          qb_customer_memo?: string | null
          shipping_date?: string | null
          tracking_number?: string | null
          shipping_method?: string | null
          qb_created_time?: string | null
          qb_last_updated_time?: string | null
          sent_to_qb_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}