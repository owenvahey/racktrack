-- Enhanced Inventory Tracking with Case Level Support

-- Add case-level fields to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS units_per_case INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS case_weight_kg DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS case_dimensions JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS case_barcode_prefix TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS packaging_type TEXT CHECK (packaging_type IN (
  'box', 'bag', 'bottle', 'can', 'jar', 'drum', 'pail', 'roll', 'sheet', 'other'
));

-- Create pallet contents table for multi-level tracking
CREATE TABLE pallet_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_id UUID REFERENCES pallets(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  
  -- Case level tracking
  case_count INTEGER NOT NULL DEFAULT 0,
  units_per_case INTEGER NOT NULL DEFAULT 1,
  total_units INTEGER GENERATED ALWAYS AS (case_count * units_per_case) STORED,
  
  -- Remaining inventory (tracks consumption)
  cases_remaining INTEGER NOT NULL DEFAULT 0,
  loose_units_remaining INTEGER NOT NULL DEFAULT 0, -- partial case units
  total_units_remaining INTEGER GENERATED ALWAYS AS 
    ((cases_remaining * units_per_case) + loose_units_remaining) STORED,
  
  -- Lot tracking
  lot_number TEXT,
  expiration_date DATE,
  received_date TIMESTAMPTZ DEFAULT NOW(),
  
  -- Quality and cost
  quality_status TEXT CHECK (quality_status IN (
    'pending', 'approved', 'rejected', 'quarantine'
  )) DEFAULT 'pending',
  unit_cost DECIMAL(10,4),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one product entry per pallet/lot combination
  UNIQUE(pallet_id, product_id, lot_number)
);

-- Pallet label management
CREATE TABLE pallet_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_id UUID REFERENCES pallets(id) ON DELETE CASCADE,
  
  -- Label identification
  label_code TEXT UNIQUE NOT NULL, -- barcode value
  label_type TEXT CHECK (label_type IN ('master', 'case', 'unit')) DEFAULT 'master',
  
  -- Label content
  content_summary JSONB NOT NULL, -- snapshot of pallet contents when printed
  
  -- Tracking
  printed_at TIMESTAMPTZ DEFAULT NOW(),
  printed_by UUID REFERENCES profiles(id),
  printer_name TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES profiles(id),
  void_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced consumption tracking
CREATE TABLE inventory_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_content_id UUID REFERENCES pallet_contents(id),
  
  -- What was consumed
  consumed_cases INTEGER DEFAULT 0,
  consumed_units INTEGER DEFAULT 0, -- individual units (not from full cases)
  total_consumed_units INTEGER GENERATED ALWAYS AS 
    ((consumed_cases * units_per_case) + consumed_units) STORED,
  units_per_case INTEGER NOT NULL, -- snapshot at consumption time
  
  -- How it was consumed
  consumption_type TEXT CHECK (consumption_type IN (
    'full_case', 'partial_case', 'individual', 'mixed'
  )) NOT NULL,
  
  -- For production tracking
  job_route_id UUID REFERENCES job_routes(id),
  job_material_consumption_id UUID REFERENCES job_material_consumption(id),
  
  -- Who and when
  consumed_by UUID REFERENCES profiles(id),
  consumed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Additional info
  notes TEXT,
  device_info JSONB
);

-- Receiving session management
CREATE TABLE receiving_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number TEXT UNIQUE NOT NULL, -- RCV-YYYYMMDD-###
  
  -- Session info
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('open', 'completed', 'cancelled')) DEFAULT 'open',
  
  -- References
  po_reference TEXT,
  supplier_name TEXT,
  supplier_info JSONB,
  
  -- Who
  received_by UUID REFERENCES profiles(id),
  
  -- Summary
  total_pallets INTEGER DEFAULT 0,
  total_products INTEGER DEFAULT 0,
  total_cases INTEGER DEFAULT 0,
  total_units INTEGER DEFAULT 0,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items received in a session
CREATE TABLE receiving_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES receiving_sessions(id) ON DELETE CASCADE,
  pallet_id UUID REFERENCES pallets(id),
  product_id UUID REFERENCES products(id),
  
  -- Quantities
  cases_received INTEGER NOT NULL,
  units_per_case INTEGER NOT NULL,
  total_units_received INTEGER GENERATED ALWAYS AS (cases_received * units_per_case) STORED,
  
  -- Quality check
  quality_check_status TEXT CHECK (quality_check_status IN (
    'pending', 'passed', 'failed', 'partial'
  )) DEFAULT 'pending',
  quality_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to generate receiving session number
CREATE OR REPLACE FUNCTION generate_receiving_session_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  date_part TEXT;
  sequence_part TEXT;
  existing_count INTEGER;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  SELECT COUNT(*) INTO existing_count
  FROM receiving_sessions 
  WHERE session_number LIKE 'RCV-' || date_part || '-%';
  
  sequence_part := LPAD((existing_count + 1)::TEXT, 3, '0');
  new_number := 'RCV-' || date_part || '-' || sequence_part;
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger for receiving session number
CREATE OR REPLACE FUNCTION set_receiving_session_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_number IS NULL OR NEW.session_number = '' THEN
    NEW.session_number := generate_receiving_session_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_receiving_session_number
  BEFORE INSERT ON receiving_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_receiving_session_number();

-- Function to consume inventory
CREATE OR REPLACE FUNCTION consume_pallet_inventory(
  p_pallet_content_id UUID,
  p_cases INTEGER,
  p_units INTEGER,
  p_consumed_by UUID,
  p_job_route_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  cases_consumed INTEGER,
  units_consumed INTEGER,
  cases_remaining INTEGER,
  loose_units_remaining INTEGER
) AS $$
DECLARE
  v_units_per_case INTEGER;
  v_cases_remaining INTEGER;
  v_loose_units_remaining INTEGER;
  v_total_requested_units INTEGER;
  v_total_available_units INTEGER;
  v_consumption_type TEXT;
  v_actual_cases_consumed INTEGER;
  v_actual_units_consumed INTEGER;
BEGIN
  -- Get current inventory
  SELECT 
    pc.units_per_case,
    pc.cases_remaining,
    pc.loose_units_remaining,
    pc.total_units_remaining
  INTO 
    v_units_per_case,
    v_cases_remaining,
    v_loose_units_remaining,
    v_total_available_units
  FROM pallet_contents pc
  WHERE id = p_pallet_content_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pallet content not found';
  END IF;
  
  -- Calculate total requested units
  v_total_requested_units := (p_cases * v_units_per_case) + p_units;
  
  -- Check availability
  IF v_total_requested_units > v_total_available_units THEN
    RAISE EXCEPTION 'Insufficient inventory. Requested: %, Available: %', 
      v_total_requested_units, v_total_available_units;
  END IF;
  
  -- Determine consumption type
  IF p_cases > 0 AND p_units > 0 THEN
    v_consumption_type := 'mixed';
  ELSIF p_cases > 0 THEN
    v_consumption_type := 'full_case';
  ELSIF p_units > 0 THEN
    v_consumption_type := 'partial_case';
  ELSE
    RAISE EXCEPTION 'Must consume at least 1 case or 1 unit';
  END IF;
  
  -- Calculate actual consumption
  v_actual_cases_consumed := p_cases;
  v_actual_units_consumed := p_units;
  
  -- Adjust loose units if consuming more than available
  IF v_actual_units_consumed > v_loose_units_remaining THEN
    -- Need to break a case
    v_actual_cases_consumed := v_actual_cases_consumed + 1;
    v_actual_units_consumed := v_actual_units_consumed - v_units_per_case;
  END IF;
  
  -- Update remaining inventory
  UPDATE pallet_contents
  SET 
    cases_remaining = cases_remaining - v_actual_cases_consumed,
    loose_units_remaining = CASE 
      WHEN v_actual_units_consumed > loose_units_remaining THEN
        (v_units_per_case - (v_actual_units_consumed - loose_units_remaining))
      ELSE
        loose_units_remaining - v_actual_units_consumed
    END,
    updated_at = NOW()
  WHERE id = p_pallet_content_id
  RETURNING cases_remaining, loose_units_remaining
  INTO v_cases_remaining, v_loose_units_remaining;
  
  -- Log consumption
  INSERT INTO inventory_consumption (
    pallet_content_id,
    consumed_cases,
    consumed_units,
    units_per_case,
    consumption_type,
    job_route_id,
    consumed_by,
    notes
  ) VALUES (
    p_pallet_content_id,
    p_cases,
    p_units,
    v_units_per_case,
    v_consumption_type,
    p_job_route_id,
    p_consumed_by,
    p_notes
  );
  
  RETURN QUERY SELECT 
    TRUE,
    v_actual_cases_consumed,
    v_actual_units_consumed,
    v_cases_remaining,
    v_loose_units_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migrate existing inventory to new structure
INSERT INTO pallet_contents (
  pallet_id,
  product_id,
  case_count,
  units_per_case,
  cases_remaining,
  loose_units_remaining,
  lot_number,
  expiration_date,
  quality_status,
  unit_cost
)
SELECT 
  i.pallet_id,
  i.product_id,
  CASE 
    WHEN p.units_per_case > 1 THEN i.quantity / p.units_per_case
    ELSE i.quantity
  END as case_count,
  COALESCE(p.units_per_case, 1) as units_per_case,
  CASE 
    WHEN p.units_per_case > 1 THEN i.available_quantity / p.units_per_case
    ELSE i.available_quantity
  END as cases_remaining,
  CASE 
    WHEN p.units_per_case > 1 THEN i.available_quantity % p.units_per_case
    ELSE 0
  END as loose_units_remaining,
  i.lot_number,
  i.expiration_date,
  i.quality_status,
  i.unit_cost
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM pallet_contents pc 
  WHERE pc.pallet_id = i.pallet_id 
  AND pc.product_id = i.product_id
  AND pc.lot_number IS NOT DISTINCT FROM i.lot_number
);

-- Indexes
CREATE INDEX idx_pallet_contents_pallet ON pallet_contents(pallet_id);
CREATE INDEX idx_pallet_contents_product ON pallet_contents(product_id);
CREATE INDEX idx_pallet_contents_lot ON pallet_contents(lot_number);
CREATE INDEX idx_pallet_labels_pallet ON pallet_labels(pallet_id);
CREATE INDEX idx_pallet_labels_code ON pallet_labels(label_code);
CREATE INDEX idx_consumption_pallet_content ON inventory_consumption(pallet_content_id);
CREATE INDEX idx_consumption_job ON inventory_consumption(job_route_id);
CREATE INDEX idx_receiving_items_session ON receiving_items(session_id);

-- Triggers
CREATE TRIGGER update_pallet_contents_updated_at BEFORE UPDATE ON pallet_contents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receiving_sessions_updated_at BEFORE UPDATE ON receiving_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE pallet_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pallet_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_items ENABLE ROW LEVEL SECURITY;

-- Pallet contents policies
CREATE POLICY "All authenticated users can view pallet contents" ON pallet_contents
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Workers can manage pallet contents" ON pallet_contents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'worker')
    )
  );

-- Label policies
CREATE POLICY "All authenticated users can view labels" ON pallet_labels
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Workers can create labels" ON pallet_labels
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'worker')
    )
  );

-- Consumption policies
CREATE POLICY "All authenticated users can view consumption" ON inventory_consumption
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Workers can log consumption" ON inventory_consumption
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'worker')
    )
  );

-- Receiving policies
CREATE POLICY "All authenticated users can view receiving" ON receiving_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Workers can manage receiving" ON receiving_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'worker')
    )
  );

CREATE POLICY "All authenticated users can view receiving items" ON receiving_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Workers can manage receiving items" ON receiving_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'worker')
    )
  );