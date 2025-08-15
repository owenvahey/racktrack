-- Work Centers and Activities Infrastructure

-- Work Centers table
CREATE TABLE work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Work center type
  type TEXT CHECK (type IN (
    'printing', 'embroidery', 'heat_press', 'cutting', 
    'sewing', 'packaging', 'quality_control', 'shipping', 'other'
  )) NOT NULL,
  
  -- Capacity and cost
  capacity_per_hour DECIMAL(10,2),
  cost_per_hour DECIMAL(10,2),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Activity categorization
  activity_type TEXT CHECK (activity_type IN (
    'setup', 'production', 'quality_check', 'packaging', 'cleanup', 'maintenance'
  )) NOT NULL,
  
  -- Skill requirements
  requires_skill_level INTEGER DEFAULT 1 CHECK (requires_skill_level BETWEEN 1 AND 5),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link work centers to activities they can perform
CREATE TABLE work_center_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_center_id UUID REFERENCES work_centers(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  
  -- Time estimates
  setup_time_minutes INTEGER DEFAULT 0,
  run_time_per_unit DECIMAL(10,4), -- minutes per unit
  
  -- Batch constraints
  min_batch_size INTEGER DEFAULT 1,
  max_batch_size INTEGER,
  
  -- Efficiency factor (1.0 = 100%)
  efficiency_factor DECIMAL(3,2) DEFAULT 1.0 CHECK (efficiency_factor > 0 AND efficiency_factor <= 2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(work_center_id, activity_id)
);

-- Activity dependencies for workflow
CREATE TABLE activity_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  depends_on_activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  
  -- Dependency type
  dependency_type TEXT CHECK (dependency_type IN (
    'finish_to_start',  -- Most common: previous must finish before this starts
    'start_to_start',   -- Both can start together
    'finish_to_finish', -- Both must finish together
    'start_to_finish'   -- Rare: this must start before previous finishes
  )) DEFAULT 'finish_to_start',
  
  -- Lead/lag time in minutes (negative = lag, positive = lead)
  offset_minutes INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(activity_id, depends_on_activity_id),
  CHECK (activity_id != depends_on_activity_id)
);

-- Rename existing job_activities to job_audit_log
ALTER TABLE job_activities RENAME TO job_audit_log;

-- Create new job_routes table for production tracking
CREATE TABLE job_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  job_line_item_id UUID REFERENCES job_line_items(id) ON DELETE CASCADE,
  
  -- Route details
  activity_id UUID REFERENCES activities(id),
  work_center_id UUID REFERENCES work_centers(id),
  sequence_number INTEGER NOT NULL,
  
  -- Status tracking
  status TEXT CHECK (status IN (
    'pending', 'ready', 'setup', 'in_progress', 'paused', 'completed', 'skipped'
  )) DEFAULT 'pending',
  
  -- Time tracking
  estimated_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  estimated_complete TIMESTAMPTZ,
  actual_complete TIMESTAMPTZ,
  
  -- Quantity tracking
  quantity_target INTEGER NOT NULL,
  quantity_completed INTEGER DEFAULT 0,
  quantity_scrapped INTEGER DEFAULT 0,
  
  -- Who worked on it
  operator_id UUID REFERENCES profiles(id),
  
  -- Notes
  setup_notes TEXT,
  production_notes TEXT,
  quality_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(job_id, sequence_number)
);

-- Material consumption tracking
CREATE TABLE job_material_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  job_route_id UUID REFERENCES job_routes(id) ON DELETE CASCADE,
  
  -- Material details
  material_product_id UUID REFERENCES products(id),
  
  -- Quantities
  quantity_planned DECIMAL(12,4) NOT NULL,
  quantity_consumed DECIMAL(12,4) DEFAULT 0,
  unit_of_measure TEXT NOT NULL,
  
  -- Tracking
  lot_number TEXT,
  consumed_at TIMESTAMPTZ,
  consumed_by UUID REFERENCES profiles(id),
  
  -- From which inventory
  inventory_id UUID REFERENCES inventory(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate existing work_center data
INSERT INTO work_centers (code, name, type, is_active)
SELECT DISTINCT 
  UPPER(REPLACE(work_center, ' ', '_')) as code,
  INITCAP(work_center) as name,
  CASE 
    WHEN work_center = 'printing' THEN 'printing'
    WHEN work_center = 'embroidery' THEN 'embroidery'
    WHEN work_center = 'fulfillment' THEN 'packaging'
    ELSE 'other'
  END as type,
  TRUE
FROM jobs 
WHERE work_center IS NOT NULL AND work_center != '';

-- Create some default activities
INSERT INTO activities (code, name, activity_type, requires_skill_level) VALUES
  ('SETUP_SCREEN', 'Screen Setup', 'setup', 3),
  ('PRINT_MANUAL', 'Manual Screen Printing', 'production', 2),
  ('PRINT_AUTO', 'Automatic Screen Printing', 'production', 2),
  ('EMBR_SETUP', 'Embroidery Machine Setup', 'setup', 3),
  ('EMBR_RUN', 'Embroidery Production', 'production', 1),
  ('HEAT_PRESS', 'Heat Press Application', 'production', 1),
  ('CUT_VINYL', 'Vinyl Cutting', 'production', 2),
  ('QC_VISUAL', 'Visual Quality Check', 'quality_check', 1),
  ('QC_MEASURE', 'Measurement Check', 'quality_check', 2),
  ('PACK_INDIVIDUAL', 'Individual Packaging', 'packaging', 1),
  ('PACK_BULK', 'Bulk Packaging', 'packaging', 1),
  ('CLEAN_SCREEN', 'Screen Cleaning', 'cleanup', 1);

-- Create default work center activity assignments
INSERT INTO work_center_activities (work_center_id, activity_id, setup_time_minutes, run_time_per_unit)
SELECT 
  wc.id,
  a.id,
  CASE 
    WHEN a.activity_type = 'setup' THEN 30
    ELSE 5
  END,
  CASE
    WHEN a.code = 'PRINT_MANUAL' THEN 0.5
    WHEN a.code = 'PRINT_AUTO' THEN 0.1
    WHEN a.code = 'EMBR_RUN' THEN 2.0
    WHEN a.code = 'HEAT_PRESS' THEN 0.3
    ELSE 0.2
  END
FROM work_centers wc
CROSS JOIN activities a
WHERE 
  (wc.type = 'printing' AND a.code IN ('SETUP_SCREEN', 'PRINT_MANUAL', 'PRINT_AUTO', 'QC_VISUAL', 'CLEAN_SCREEN'))
  OR (wc.type = 'embroidery' AND a.code IN ('EMBR_SETUP', 'EMBR_RUN', 'QC_VISUAL'))
  OR (wc.type = 'heat_press' AND a.code IN ('HEAT_PRESS', 'CUT_VINYL'))
  OR (wc.type = 'packaging' AND a.code IN ('QC_VISUAL', 'QC_MEASURE', 'PACK_INDIVIDUAL', 'PACK_BULK'));

-- Indexes
CREATE INDEX idx_work_center_activities_wc ON work_center_activities(work_center_id);
CREATE INDEX idx_work_center_activities_act ON work_center_activities(activity_id);
CREATE INDEX idx_activity_deps_activity ON activity_dependencies(activity_id);
CREATE INDEX idx_activity_deps_depends ON activity_dependencies(depends_on_activity_id);
CREATE INDEX idx_job_routes_job ON job_routes(job_id);
CREATE INDEX idx_job_routes_status ON job_routes(status);
CREATE INDEX idx_job_routes_work_center ON job_routes(work_center_id);
CREATE INDEX idx_job_material_job ON job_material_consumption(job_id);
CREATE INDEX idx_job_material_route ON job_material_consumption(job_route_id);

-- Triggers
CREATE TRIGGER update_work_centers_updated_at BEFORE UPDATE ON work_centers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_routes_updated_at BEFORE UPDATE ON job_routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE work_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_center_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_material_consumption ENABLE ROW LEVEL SECURITY;

-- Work center policies
CREATE POLICY "Users can view work centers" ON work_centers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage work centers" ON work_centers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Activity policies
CREATE POLICY "Users can view activities" ON activities
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage activities" ON activities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Work center activities policies
CREATE POLICY "Users can view work center activities" ON work_center_activities
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage work center activities" ON work_center_activities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Activity dependencies policies
CREATE POLICY "Users can view activity dependencies" ON activity_dependencies
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage activity dependencies" ON activity_dependencies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Job routes policies
CREATE POLICY "Users can view job routes" ON job_routes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Workers can update assigned job routes" ON job_routes
  FOR UPDATE USING (
    operator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Managers can manage job routes" ON job_routes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Material consumption policies
CREATE POLICY "Users can view material consumption" ON job_material_consumption
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Workers can log material consumption" ON job_material_consumption
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage material consumption" ON job_material_consumption
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );