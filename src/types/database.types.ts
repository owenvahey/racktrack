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