-- Create customer purchase orders table to extend QB estimates
CREATE TABLE customer_pos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  qb_estimate_id TEXT UNIQUE,
  qb_estimate_number TEXT,
  qb_sync_token TEXT,
  
  -- Customer information
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  qb_customer_id TEXT,
  
  -- PO details
  description TEXT,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  
  -- Production tracking
  production_status TEXT NOT NULL DEFAULT 'draft' CHECK (production_status IN (
    'draft',
    'pending_approval',
    'approved',
    'sent_to_production',
    'in_production',
    'on_hold',
    'quality_check',
    'ready_for_invoice',
    'invoiced',
    'cancelled'
  )),
  
  -- Additional status fields
  hold_reason TEXT,
  production_notes TEXT,
  production_started_at TIMESTAMPTZ,
  production_completed_at TIMESTAMPTZ,
  
  -- Dates
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  ship_date DATE,
  
  -- QB Invoice tracking
  qb_invoice_id TEXT,
  invoice_created_at TIMESTAMPTZ,
  
  -- Metadata
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_customer_pos_customer_id ON customer_pos(customer_id);
CREATE INDEX idx_customer_pos_qb_estimate_id ON customer_pos(qb_estimate_id);
CREATE INDEX idx_customer_pos_production_status ON customer_pos(production_status);
CREATE INDEX idx_customer_pos_po_date ON customer_pos(po_date);
CREATE INDEX idx_customer_pos_due_date ON customer_pos(due_date);

-- Create PO line items table
CREATE TABLE customer_po_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES customer_pos(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  qb_item_id TEXT,
  
  -- Item details
  line_number INTEGER NOT NULL,
  description TEXT,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_of_measure TEXT,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  -- Production tracking
  quantity_produced DECIMAL(10, 2) DEFAULT 0,
  quantity_shipped DECIMAL(10, 2) DEFAULT 0,
  production_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for PO items
CREATE INDEX idx_customer_po_items_po_id ON customer_po_items(po_id);
CREATE INDEX idx_customer_po_items_product_id ON customer_po_items(product_id);

-- Create production status history table
CREATE TABLE customer_po_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES customer_pos(id) ON DELETE CASCADE,
  
  -- Status change
  from_status TEXT,
  to_status TEXT NOT NULL,
  change_reason TEXT,
  notes TEXT,
  
  -- User who made the change
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for status history
CREATE INDEX idx_customer_po_status_history_po_id ON customer_po_status_history(po_id);
CREATE INDEX idx_customer_po_status_history_changed_at ON customer_po_status_history(changed_at);

-- Create updated_at trigger
CREATE TRIGGER update_customer_pos_updated_at
  BEFORE UPDATE ON customer_pos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_po_items_updated_at
  BEFORE UPDATE ON customer_po_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to update PO totals
CREATE OR REPLACE FUNCTION update_customer_po_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customer_pos
  SET total_amount = (
    SELECT COALESCE(SUM(total_amount), 0)
    FROM customer_po_items
    WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
  )
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update PO totals when items change
CREATE TRIGGER update_po_totals_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON customer_po_items
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_po_totals();

-- Create function to track status changes
CREATE OR REPLACE FUNCTION track_customer_po_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.production_status IS DISTINCT FROM NEW.production_status THEN
    INSERT INTO customer_po_status_history (
      po_id,
      from_status,
      to_status,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.production_status,
      NEW.production_status,
      NEW.updated_by
    );
    
    -- Update production timestamps
    IF NEW.production_status = 'sent_to_production' AND OLD.production_started_at IS NULL THEN
      NEW.production_started_at = NOW();
    ELSIF NEW.production_status IN ('ready_for_invoice', 'invoiced') AND OLD.production_completed_at IS NULL THEN
      NEW.production_completed_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to track status changes
CREATE TRIGGER track_po_status_changes
  BEFORE UPDATE ON customer_pos
  FOR EACH ROW
  EXECUTE FUNCTION track_customer_po_status_change();

-- Create RLS policies
ALTER TABLE customer_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_po_status_history ENABLE ROW LEVEL SECURITY;

-- Customer POs policies
CREATE POLICY "Users can view all customer POs" ON customer_pos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create customer POs" ON customer_pos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'user')
    )
  );

CREATE POLICY "Users can update customer POs" ON customer_pos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'user')
    )
  );

-- PO items policies
CREATE POLICY "Users can view PO items" ON customer_po_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can manage PO items" ON customer_po_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'user')
    )
  );

-- Status history policies
CREATE POLICY "Users can view status history" ON customer_po_status_history
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "System can insert status history" ON customer_po_status_history
  FOR INSERT TO authenticated
  WITH CHECK (true);