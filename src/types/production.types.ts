// Work Centers and Activities Types

export interface WorkCenter {
  id: string
  code: string
  name: string
  description?: string
  type: 'printing' | 'embroidery' | 'heat_press' | 'cutting' | 'sewing' | 'packaging' | 'quality_control' | 'shipping' | 'other'
  capacity_per_hour?: number
  cost_per_hour?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  code: string
  name: string
  description?: string
  activity_type: 'setup' | 'production' | 'quality_check' | 'packaging' | 'cleanup' | 'maintenance'
  requires_skill_level: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkCenterActivity {
  id: string
  work_center_id: string
  activity_id: string
  setup_time_minutes: number
  run_time_per_unit?: number
  min_batch_size: number
  max_batch_size?: number
  efficiency_factor: number
  created_at: string
  // Relations
  work_center?: WorkCenter
  activity?: Activity
}

export interface ActivityDependency {
  id: string
  activity_id: string
  depends_on_activity_id: string
  dependency_type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish'
  offset_minutes: number
  created_at: string
  // Relations
  activity?: Activity
  depends_on?: Activity
}

// Bill of Materials Types

export interface ProductBOM {
  id: string
  product_id: string
  version_number: number
  status: 'draft' | 'pending_approval' | 'active' | 'obsolete'
  effective_date?: string
  obsolete_date?: string
  notes?: string
  created_by?: string
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
  // Relations
  product?: any
  materials?: BOMMaterial[]
  activities?: BOMActivity[]
}

export interface BOMMaterial {
  id: string
  bom_id: string
  material_product_id: string
  quantity_required: number
  unit_of_measure: string
  waste_percentage: number
  notes?: string
  created_at: string
  updated_at: string
  // Relations
  material_product?: any
}

export interface BOMActivity {
  id: string
  bom_id: string
  activity_id: string
  work_center_id: string
  sequence_number: number
  setup_time_minutes: number
  run_time_per_unit?: number
  instructions?: string
  quality_check_required: boolean
  quality_instructions?: string
  created_at: string
  updated_at: string
  // Relations
  activity?: Activity
  work_center?: WorkCenter
}

// Enhanced Job Tracking Types

export interface JobRoute {
  id: string
  job_id: string
  job_line_item_id?: string
  activity_id: string
  work_center_id: string
  sequence_number: number
  status: 'pending' | 'ready' | 'setup' | 'in_progress' | 'paused' | 'completed' | 'skipped'
  estimated_start?: string
  actual_start?: string
  estimated_complete?: string
  actual_complete?: string
  quantity_target: number
  quantity_completed: number
  quantity_scrapped: number
  operator_id?: string
  setup_notes?: string
  production_notes?: string
  quality_notes?: string
  created_at: string
  updated_at: string
  // Relations
  activity?: Activity
  work_center?: WorkCenter
  operator?: any
}

export interface JobMaterialConsumption {
  id: string
  job_id: string
  job_route_id?: string
  material_product_id: string
  quantity_planned: number
  quantity_consumed: number
  unit_of_measure: string
  lot_number?: string
  consumed_at?: string
  consumed_by?: string
  inventory_id?: string
  created_at: string
  // Relations
  material_product?: any
  consumed_by_user?: any
}

// Helper types for UI

export interface WorkCenterWithActivities extends WorkCenter {
  activities: (WorkCenterActivity & { activity: Activity })[]
}

export interface BOMWithDetails extends ProductBOM {
  materials: (BOMMaterial & { material_product: any })[]
  activities: (BOMActivity & { 
    activity: Activity
    work_center: WorkCenter 
  })[]
}

export interface JobRouteWithDetails extends JobRoute {
  activity: Activity
  work_center: WorkCenter
  operator?: any
  material_consumption?: JobMaterialConsumption[]
}

// Form types

export interface CreateBOMInput {
  product_id: string
  notes?: string
  materials: {
    material_product_id: string
    quantity_required: number
    unit_of_measure: string
    waste_percentage?: number
  }[]
  activities: {
    activity_id: string
    work_center_id: string
    sequence_number: number
    setup_time_minutes?: number
    run_time_per_unit?: number
    instructions?: string
  }[]
}

export interface ProductionEntryInput {
  job_route_id: string
  quantity_completed: number
  quantity_scrapped?: number
  production_notes?: string
  material_consumption?: {
    material_product_id: string
    quantity_consumed: number
    lot_number?: string
    inventory_id?: string
  }[]
}