-- Add product type to distinguish raw materials from finished goods
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT 
  CHECK (product_type IN ('raw_material', 'finished_good', 'component', 'packaging')) 
  DEFAULT 'raw_material';

-- Update inventory consumption to enforce business rules
ALTER TABLE inventory_consumption ADD COLUMN IF NOT EXISTS shipment_id UUID;
ALTER TABLE inventory_consumption ADD FOREIGN KEY (shipment_id) REFERENCES shipments(id);

-- Create shipments table if not exists
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number TEXT UNIQUE NOT NULL, -- SHP-YYYYMMDD-###
  
  -- Shipment details
  status TEXT CHECK (status IN (
    'preparing', 'picked', 'packed', 'ready', 'shipped', 'delivered', 'cancelled'
  )) DEFAULT 'preparing',
  
  -- Customer and order info
  customer_id UUID REFERENCES qb_customers(id),
  customer_name TEXT NOT NULL,
  po_reference TEXT,
  
  -- Addresses
  shipping_address JSONB,
  billing_address JSONB,
  
  -- Dates
  requested_ship_date DATE,
  actual_ship_date DATE,
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  
  -- Shipping info
  carrier TEXT,
  tracking_number TEXT,
  shipping_method TEXT,
  shipping_cost DECIMAL(10,2),
  
  -- Who and when
  prepared_by UUID REFERENCES profiles(id),
  shipped_by UUID REFERENCES profiles(id),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipment line items
CREATE TABLE IF NOT EXISTS shipment_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  
  -- Product info
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  
  -- Quantities (in units, not cases)
  quantity_ordered INTEGER NOT NULL,
  quantity_shipped INTEGER DEFAULT 0,
  
  -- From which pallet/inventory
  pallet_content_id UUID REFERENCES pallet_contents(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to generate shipment number
CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  date_part TEXT;
  sequence_part TEXT;
  existing_count INTEGER;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  SELECT COUNT(*) INTO existing_count
  FROM shipments 
  WHERE shipment_number LIKE 'SHP-' || date_part || '-%';
  
  sequence_part := LPAD((existing_count + 1)::TEXT, 3, '0');
  new_number := 'SHP-' || date_part || '-' || sequence_part;
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger for shipment number
CREATE OR REPLACE FUNCTION set_shipment_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shipment_number IS NULL OR NEW.shipment_number = '' THEN
    NEW.shipment_number := generate_shipment_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_shipment_number
  BEFORE INSERT ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION set_shipment_number();

-- Updated consumption function with business rules
CREATE OR REPLACE FUNCTION consume_inventory_with_rules(
  p_pallet_content_id UUID,
  p_cases INTEGER,
  p_units INTEGER,
  p_consumed_by UUID,
  p_job_route_id UUID DEFAULT NULL,
  p_shipment_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  cases_consumed INTEGER,
  units_consumed INTEGER,
  cases_remaining INTEGER,
  loose_units_remaining INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_product_type TEXT;
  v_units_per_case INTEGER;
  v_cases_remaining INTEGER;
  v_loose_units_remaining INTEGER;
  v_total_requested_units INTEGER;
  v_total_available_units INTEGER;
  v_consumption_type TEXT;
  v_actual_cases_consumed INTEGER;
  v_actual_units_consumed INTEGER;
BEGIN
  -- Get product type and current inventory
  SELECT 
    p.product_type,
    pc.units_per_case,
    pc.cases_remaining,
    pc.loose_units_remaining,
    pc.total_units_remaining
  INTO 
    v_product_type,
    v_units_per_case,
    v_cases_remaining,
    v_loose_units_remaining,
    v_total_available_units
  FROM pallet_contents pc
  JOIN products p ON pc.product_id = p.id
  WHERE pc.id = p_pallet_content_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 'Pallet content not found'::TEXT;
    RETURN;
  END IF;
  
  -- Enforce business rules
  IF v_product_type IN ('raw_material', 'component', 'packaging') THEN
    -- Raw materials can only be consumed by jobs
    IF p_job_route_id IS NULL THEN
      RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 'Raw materials can only be consumed by production jobs'::TEXT;
      RETURN;
    END IF;
    IF p_shipment_id IS NOT NULL THEN
      RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 'Raw materials cannot be shipped directly'::TEXT;
      RETURN;
    END IF;
  ELSIF v_product_type = 'finished_good' THEN
    -- Finished goods can only be consumed by shipments
    IF p_shipment_id IS NULL THEN
      RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 'Finished goods can only be consumed by shipments'::TEXT;
      RETURN;
    END IF;
    IF p_job_route_id IS NOT NULL THEN
      RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 'Finished goods cannot be consumed in production'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Calculate total requested units
  v_total_requested_units := (p_cases * v_units_per_case) + p_units;
  
  -- Check availability
  IF v_total_requested_units > v_total_available_units THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 
      format('Insufficient inventory. Requested: %s, Available: %s', v_total_requested_units, v_total_available_units)::TEXT;
    RETURN;
  END IF;
  
  -- Determine consumption type
  IF p_cases > 0 AND p_units > 0 THEN
    v_consumption_type := 'mixed';
  ELSIF p_cases > 0 THEN
    v_consumption_type := 'full_case';
  ELSIF p_units > 0 THEN
    v_consumption_type := 'partial_case';
  ELSE
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 'Must consume at least 1 case or 1 unit'::TEXT;
    RETURN;
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
    shipment_id,
    consumed_by,
    notes
  ) VALUES (
    p_pallet_content_id,
    p_cases,
    p_units,
    v_units_per_case,
    v_consumption_type,
    p_job_route_id,
    p_shipment_id,
    p_consumed_by,
    p_notes
  );
  
  RETURN QUERY SELECT 
    TRUE,
    v_actual_cases_consumed,
    v_actual_units_consumed,
    v_cases_remaining,
    v_loose_units_remaining,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update job material consumption to use new function
CREATE OR REPLACE FUNCTION consume_job_materials(
  p_job_route_id UUID,
  p_material_consumptions JSONB -- Array of {pallet_content_id, cases, units}
)
RETURNS TABLE (
  success BOOLEAN,
  consumed_count INTEGER,
  error_messages TEXT[]
) AS $$
DECLARE
  v_consumption JSONB;
  v_result RECORD;
  v_consumed_count INTEGER := 0;
  v_errors TEXT[] := '{}';
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Process each consumption
  FOR v_consumption IN SELECT * FROM jsonb_array_elements(p_material_consumptions)
  LOOP
    SELECT * INTO v_result FROM consume_inventory_with_rules(
      (v_consumption->>'pallet_content_id')::UUID,
      (v_consumption->>'cases')::INTEGER,
      (v_consumption->>'units')::INTEGER,
      v_user_id,
      p_job_route_id,
      NULL,
      v_consumption->>'notes'
    );
    
    IF v_result.success THEN
      v_consumed_count := v_consumed_count + 1;
    ELSE
      v_errors := array_append(v_errors, v_result.error_message);
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT 
    v_consumed_count = jsonb_array_length(p_material_consumptions),
    v_consumed_count,
    v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_customer ON shipments(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment ON shipment_line_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_product ON shipment_line_items(product_id);

-- Triggers
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipment_line_items_updated_at BEFORE UPDATE ON shipment_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_line_items ENABLE ROW LEVEL SECURITY;

-- Shipment policies
CREATE POLICY "All authenticated users can view shipments" ON shipments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Workers can manage shipments" ON shipments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'worker')
    )
  );

-- Shipment line item policies
CREATE POLICY "All authenticated users can view shipment items" ON shipment_line_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Workers can manage shipment items" ON shipment_line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'worker')
    )
  );

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION consume_inventory_with_rules TO authenticated;
GRANT EXECUTE ON FUNCTION consume_job_materials TO authenticated;