import { Database } from './database.types'

export type Product = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export type Aisle = Database['public']['Tables']['aisles']['Row']
export type Shelf = Database['public']['Tables']['shelves']['Row']
export type StorageSlot = Database['public']['Tables']['storage_slots']['Row']

export type Pallet = Database['public']['Tables']['pallets']['Row']
export type PalletInsert = Database['public']['Tables']['pallets']['Insert']
export type PalletUpdate = Database['public']['Tables']['pallets']['Update']

export type Inventory = Database['public']['Tables']['inventory']['Row']
export type InventoryInsert = Database['public']['Tables']['inventory']['Insert']
export type InventoryUpdate = Database['public']['Tables']['inventory']['Update']

export type InventoryMovement = Database['public']['Tables']['inventory_movements']['Row']
export type InventoryMovementInsert = Database['public']['Tables']['inventory_movements']['Insert']

export interface StorageLocation {
  id: string
  full_location: string
  is_occupied: boolean
  current_pallet_id: string | null
  zone: string | null
  warehouse_id: string
  warehouse_name: string
  aisle_id: string
  aisle_code: string
  shelf_id: string
  shelf_code: string
  level_number: number
  slot_code: string
  position_number: number
}

export interface ProductWithInventory extends Product {
  total_quantity?: number
  available_quantity?: number
  locations?: string[]
}

export interface PalletWithDetails extends Pallet {
  location?: StorageLocation
  inventory_items?: Array<{
    inventory: Inventory
    product: Product
  }>
}

export type MovementType = 'receive' | 'move' | 'pick' | 'ship' | 'adjust' | 'transfer' | 'return'
export type PalletStatus = 'receiving' | 'in_transit' | 'stored' | 'picking' | 'staged' | 'shipped'
export type QualityStatus = 'pending' | 'approved' | 'rejected' | 'quarantine'
export type Zone = 'receiving' | 'storage' | 'picking' | 'shipping'