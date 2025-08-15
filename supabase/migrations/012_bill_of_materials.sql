-- Bill of Materials (BOM) System

-- Product BOMs table
CREATE TABLE product_boms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  
  -- Status tracking
  status TEXT CHECK (status IN (
    'draft', 'pending_approval', 'active', 'obsolete'
  )) DEFAULT 'draft',
  
  -- Versioning
  effective_date DATE,
  obsolete_date DATE,
  
  -- Details
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure only one active BOM per product
  UNIQUE(product_id, version_number),
  CONSTRAINT valid_dates CHECK (
    obsolete_date IS NULL OR 
    effective_date IS NULL OR 
    obsolete_date >= effective_date
  )
);

-- BOM Materials (components/ingredients)
CREATE TABLE bom_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID REFERENCES product_boms(id) ON DELETE CASCADE,
  material_product_id UUID REFERENCES products(id),
  
  -- Quantities
  quantity_required DECIMAL(12,4) NOT NULL,
  unit_of_measure TEXT NOT NULL,
  
  -- Waste and scrap allowance
  waste_percentage DECIMAL(5,2) DEFAULT 0 CHECK (waste_percentage >= 0 AND waste_percentage < 100),
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOM Activities (routing/operations)
CREATE TABLE bom_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID REFERENCES product_boms(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id),
  work_center_id UUID REFERENCES work_centers(id),
  
  -- Sequence
  sequence_number INTEGER NOT NULL,
  
  -- Time estimates
  setup_time_minutes INTEGER DEFAULT 0,
  run_time_per_unit DECIMAL(10,4), -- minutes per unit
  
  -- Instructions
  instructions TEXT,
  
  -- Quality requirements
  quality_check_required BOOLEAN DEFAULT FALSE,
  quality_instructions TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(bom_id, sequence_number)
);

-- Function to copy BOM to create new version
CREATE OR REPLACE FUNCTION copy_bom_version(
  source_bom_id UUID,
  new_status TEXT DEFAULT 'draft'
)
RETURNS UUID AS $$
DECLARE
  new_bom_id UUID;
  source_product_id UUID;
  new_version INTEGER;
BEGIN
  -- Get source BOM details
  SELECT product_id INTO source_product_id
  FROM product_boms
  WHERE id = source_bom_id;
  
  -- Calculate new version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO new_version
  FROM product_boms
  WHERE product_id = source_product_id;
  
  -- Create new BOM
  INSERT INTO product_boms (
    product_id, version_number, status, notes, created_by
  )
  SELECT 
    product_id, 
    new_version, 
    new_status,
    'Copied from version ' || version_number,
    auth.uid()
  FROM product_boms
  WHERE id = source_bom_id
  RETURNING id INTO new_bom_id;
  
  -- Copy materials
  INSERT INTO bom_materials (
    bom_id, material_product_id, quantity_required, 
    unit_of_measure, waste_percentage, notes
  )
  SELECT 
    new_bom_id,
    material_product_id,
    quantity_required,
    unit_of_measure,
    waste_percentage,
    notes
  FROM bom_materials
  WHERE bom_id = source_bom_id;
  
  -- Copy activities
  INSERT INTO bom_activities (
    bom_id, activity_id, work_center_id, sequence_number,
    setup_time_minutes, run_time_per_unit, instructions,
    quality_check_required, quality_instructions
  )
  SELECT
    new_bom_id,
    activity_id,
    work_center_id,
    sequence_number,
    setup_time_minutes,
    run_time_per_unit,
    instructions,
    quality_check_required,
    quality_instructions
  FROM bom_activities
  WHERE bom_id = source_bom_id;
  
  RETURN new_bom_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to activate a BOM (deactivate others for the product)
CREATE OR REPLACE FUNCTION activate_bom(
  bom_id UUID,
  effective_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  product_id UUID;
BEGIN
  -- Get product ID
  SELECT b.product_id INTO product_id
  FROM product_boms b
  WHERE b.id = bom_id;
  
  -- Deactivate other BOMs for this product
  UPDATE product_boms
  SET 
    status = 'obsolete',
    obsolete_date = effective_date - INTERVAL '1 day'
  WHERE product_boms.product_id = product_id
    AND id != bom_id
    AND status = 'active';
  
  -- Activate this BOM
  UPDATE product_boms
  SET 
    status = 'active',
    effective_date = effective_date,
    approved_by = auth.uid(),
    approved_at = NOW()
  WHERE id = bom_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create job routes from BOM
CREATE OR REPLACE FUNCTION create_job_routes_from_bom(
  p_job_id UUID,
  p_job_line_item_id UUID,
  p_quantity INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_product_id UUID;
  v_bom_id UUID;
  v_count INTEGER := 0;
  v_bom_activity RECORD;
BEGIN
  -- Get product from job line item
  SELECT 
    poi.product_id INTO v_product_id
  FROM job_line_items jli
  JOIN po_line_items poi ON jli.po_line_item_id = poi.id
  WHERE jli.id = p_job_line_item_id;
  
  -- Get active BOM for product
  SELECT id INTO v_bom_id
  FROM product_boms
  WHERE product_id = v_product_id
    AND status = 'active'
    AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
    AND (obsolete_date IS NULL OR obsolete_date > CURRENT_DATE)
  ORDER BY version_number DESC
  LIMIT 1;
  
  IF v_bom_id IS NULL THEN
    RAISE EXCEPTION 'No active BOM found for product';
  END IF;
  
  -- Create job routes from BOM activities
  FOR v_bom_activity IN 
    SELECT * FROM bom_activities 
    WHERE bom_id = v_bom_id
    ORDER BY sequence_number
  LOOP
    INSERT INTO job_routes (
      job_id,
      job_line_item_id,
      activity_id,
      work_center_id,
      sequence_number,
      quantity_target,
      status
    ) VALUES (
      p_job_id,
      p_job_line_item_id,
      v_bom_activity.activity_id,
      v_bom_activity.work_center_id,
      v_bom_activity.sequence_number,
      p_quantity,
      'pending'
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  -- Create material requirements from BOM
  INSERT INTO job_material_consumption (
    job_id,
    material_product_id,
    quantity_planned,
    unit_of_measure
  )
  SELECT
    p_job_id,
    bm.material_product_id,
    bm.quantity_required * p_quantity * (1 + bm.waste_percentage / 100),
    bm.unit_of_measure
  FROM bom_materials bm
  WHERE bm.bom_id = v_bom_id;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View to get active BOM for each product
CREATE VIEW active_product_boms AS
SELECT DISTINCT ON (pb.product_id)
  pb.*,
  p.name as product_name,
  p.sku as product_sku
FROM product_boms pb
JOIN products p ON pb.product_id = p.id
WHERE pb.status = 'active'
  AND (pb.effective_date IS NULL OR pb.effective_date <= CURRENT_DATE)
  AND (pb.obsolete_date IS NULL OR pb.obsolete_date > CURRENT_DATE)
ORDER BY pb.product_id, pb.version_number DESC;

-- Indexes
CREATE INDEX idx_product_boms_product ON product_boms(product_id);
CREATE INDEX idx_product_boms_status ON product_boms(status);
CREATE INDEX idx_bom_materials_bom ON bom_materials(bom_id);
CREATE INDEX idx_bom_materials_material ON bom_materials(material_product_id);
CREATE INDEX idx_bom_activities_bom ON bom_activities(bom_id);
CREATE INDEX idx_bom_activities_sequence ON bom_activities(bom_id, sequence_number);

-- Triggers
CREATE TRIGGER update_product_boms_updated_at BEFORE UPDATE ON product_boms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bom_materials_updated_at BEFORE UPDATE ON bom_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bom_activities_updated_at BEFORE UPDATE ON bom_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE product_boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_activities ENABLE ROW LEVEL SECURITY;

-- Product BOM policies
CREATE POLICY "Users can view BOMs" ON product_boms
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can create BOMs" ON product_boms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Managers can update draft BOMs" ON product_boms
  FOR UPDATE USING (
    status = 'draft' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete BOMs" ON product_boms
  FOR DELETE USING (public.is_admin());

-- BOM materials policies
CREATE POLICY "Users can view BOM materials" ON bom_materials
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage BOM materials" ON bom_materials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- BOM activities policies
CREATE POLICY "Users can view BOM activities" ON bom_activities
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage BOM activities" ON bom_activities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );