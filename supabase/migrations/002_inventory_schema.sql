-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  unit_of_measure TEXT DEFAULT 'each',
  weight_per_unit DECIMAL(10,4),
  dimensions JSONB, -- {length, width, height, unit}
  cost_per_unit DECIMAL(10,2),
  sell_price DECIMAL(10,2),
  barcode TEXT,
  qb_item_id TEXT, -- QuickBooks item reference
  min_stock_level INTEGER DEFAULT 0,
  max_stock_level INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category);

-- Warehouse location structure
-- Aisles
CREATE TABLE aisles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- A01, A02, B01, etc.
  name TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, code)
);

-- Shelves (vertical levels within aisles)
CREATE TABLE shelves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aisle_id UUID REFERENCES aisles(id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- S01, S02, S03, etc.
  level_number INTEGER, -- 1=ground, 2=first level up, etc.
  height_cm INTEGER,
  weight_capacity_kg DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(aisle_id, code)
);

-- Storage slots (positions on shelves)
CREATE TABLE storage_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shelf_id UUID REFERENCES shelves(id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- P01, P02, P03, etc.
  position_number INTEGER,
  
  -- Capacity and dimensions
  length_cm DECIMAL(6,2),
  width_cm DECIMAL(6,2),
  height_cm DECIMAL(6,2),
  weight_capacity_kg DECIMAL(10,2),
  
  -- Current status
  is_occupied BOOLEAN DEFAULT FALSE,
  current_pallet_id UUID,
  
  -- Metadata
  zone TEXT, -- 'receiving', 'storage', 'picking', 'shipping'
  temperature_controlled BOOLEAN DEFAULT FALSE,
  hazmat_approved BOOLEAN DEFAULT FALSE,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(shelf_id, code)
);

-- Create view for full location codes
CREATE OR REPLACE VIEW storage_locations AS
SELECT 
  s.id,
  w.code || '-' || a.code || '-' || sh.code || '-' || s.code AS full_location,
  s.is_occupied,
  s.current_pallet_id,
  s.zone,
  w.id AS warehouse_id,
  w.name AS warehouse_name,
  a.id AS aisle_id,
  a.code AS aisle_code,
  sh.id AS shelf_id,
  sh.code AS shelf_code,
  sh.level_number,
  s.code AS slot_code,
  s.position_number
FROM storage_slots s
JOIN shelves sh ON s.shelf_id = sh.id
JOIN aisles a ON sh.aisle_id = a.id
JOIN warehouses w ON a.warehouse_id = w.id
WHERE s.is_active = TRUE;

-- Pallet management
CREATE TABLE pallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_number TEXT UNIQUE NOT NULL, -- PAL-YYYYMMDD-### format
  
  -- Location tracking
  current_location_id UUID REFERENCES storage_slots(id),
  previous_location_id UUID REFERENCES storage_slots(id),
  
  -- Status tracking
  status TEXT CHECK (status IN (
    'receiving', 'in_transit', 'stored', 'picking', 'staged', 'shipped'
  )) DEFAULT 'receiving',
  
  -- Physical properties
  pallet_type TEXT DEFAULT 'standard', -- 'standard', 'euro', 'block', 'custom'
  max_weight_kg DECIMAL(10,2) DEFAULT 1000,
  max_height_cm DECIMAL(6,2) DEFAULT 200,
  current_weight_kg DECIMAL(10,2) DEFAULT 0,
  current_height_cm DECIMAL(6,2) DEFAULT 0,
  
  -- QR code for mobile scanning
  qr_code TEXT UNIQUE,
  
  -- Tracking
  received_date TIMESTAMPTZ,
  last_moved TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  
  -- Notes and special handling
  notes TEXT,
  special_handling JSONB, -- {"fragile": true, "hazmat": false, etc.}
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate pallet number
CREATE OR REPLACE FUNCTION generate_pallet_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  date_part TEXT;
  sequence_part TEXT;
  existing_count INTEGER;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  SELECT COUNT(*) INTO existing_count
  FROM pallets 
  WHERE pallet_number LIKE 'PAL-' || date_part || '-%';
  
  sequence_part := LPAD((existing_count + 1)::TEXT, 3, '0');
  new_number := 'PAL-' || date_part || '-' || sequence_part;
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate pallet numbers
CREATE OR REPLACE FUNCTION set_pallet_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pallet_number IS NULL OR NEW.pallet_number = '' THEN
    NEW.pallet_number := generate_pallet_number();
  END IF;
  
  -- Generate QR code (base64 encoding of pallet data)
  IF NEW.qr_code IS NULL THEN
    NEW.qr_code := encode(NEW.pallet_number::bytea, 'base64');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_pallet_number
  BEFORE INSERT ON pallets
  FOR EACH ROW
  EXECUTE FUNCTION set_pallet_number();

-- Inventory tracking
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  pallet_id UUID REFERENCES pallets(id) ON DELETE CASCADE,
  
  -- Quantity tracking
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  
  -- Lot and batch tracking
  lot_number TEXT,
  batch_number TEXT,
  serial_numbers TEXT[], -- For serialized items
  
  -- Dates
  manufactured_date DATE,
  expiration_date DATE,
  received_date TIMESTAMPTZ DEFAULT NOW(),
  
  -- Cost tracking
  unit_cost DECIMAL(10,4),
  total_cost DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  
  -- Quality control
  quality_status TEXT CHECK (quality_status IN (
    'pending', 'approved', 'rejected', 'quarantine'
  )) DEFAULT 'pending',
  quality_notes TEXT,
  quality_checked_by UUID REFERENCES profiles(id),
  quality_checked_at TIMESTAMPTZ,
  
  -- Metadata
  supplier_info JSONB,
  custom_fields JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_pallet_id ON inventory(pallet_id);
CREATE INDEX idx_inventory_lot_number ON inventory(lot_number);
CREATE INDEX idx_inventory_expiration ON inventory(expiration_date);

-- Inventory movement audit trail
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id),
  pallet_id UUID REFERENCES pallets(id),
  
  -- Movement details
  movement_type TEXT CHECK (movement_type IN (
    'receive', 'move', 'pick', 'ship', 'adjust', 'transfer', 'return'
  )) NOT NULL,
  
  -- Quantity changes
  quantity_before INTEGER,
  quantity_change INTEGER, -- positive for additions, negative for reductions
  quantity_after INTEGER,
  
  -- Location changes
  from_location_id UUID REFERENCES storage_slots(id),
  to_location_id UUID REFERENCES storage_slots(id),
  
  -- Reference information
  reference_type TEXT, -- 'job', 'po', 'adjustment', 'transfer'
  reference_id UUID,
  reference_number TEXT,
  
  -- Who and when
  performed_by UUID REFERENCES profiles(id) NOT NULL,
  device_info JSONB, -- scanner device, browser, etc.
  
  -- Notes and reason
  reason TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX idx_inventory_movements_inventory_id ON inventory_movements(inventory_id);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX idx_inventory_movements_date ON inventory_movements(created_at);
CREATE INDEX idx_inventory_movements_user ON inventory_movements(performed_by);

-- Add updated_at triggers
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_storage_slots_updated_at BEFORE UPDATE ON storage_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pallets_updated_at BEFORE UPDATE ON pallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE aisles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelves ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products
CREATE POLICY "All authenticated users can view products" ON products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Workers and above can manage products" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'worker')
    )
  );

-- RLS Policies for warehouse locations
CREATE POLICY "All authenticated users can view locations" ON aisles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can view locations" ON shelves
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can view locations" ON storage_slots
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and above can manage locations" ON aisles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Managers and above can manage locations" ON shelves
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Managers and above can manage locations" ON storage_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- RLS Policies for pallets and inventory
CREATE POLICY "All authenticated users can view pallets" ON pallets
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Workers and above can manage pallets" ON pallets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'worker')
    )
  );

CREATE POLICY "All authenticated users can view inventory" ON inventory
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Workers and above can manage inventory" ON inventory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'worker')
    )
  );

-- RLS Policies for movements (audit trail)
CREATE POLICY "All authenticated users can view movements" ON inventory_movements
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Workers and above can create movements" ON inventory_movements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'worker')
    )
  );