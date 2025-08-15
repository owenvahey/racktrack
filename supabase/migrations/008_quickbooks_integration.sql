-- QuickBooks Integration Schema

-- Store QB company connections
CREATE TABLE qb_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT UNIQUE NOT NULL, -- QB company ID
  company_name TEXT,
  
  -- OAuth tokens (encrypted)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  
  -- QB API details
  realm_id TEXT NOT NULL, -- QB company realm ID
  base_url TEXT NOT NULL, -- Sandbox or Production URL
  
  -- Sync configuration
  sync_enabled BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  sync_frequency_hours INTEGER DEFAULT 1,
  
  -- Error tracking
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store sync status for different data types
CREATE TABLE qb_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES qb_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'customers', 'items', 'purchase_orders', 'invoices'
  last_sync_token TEXT, -- QB change data capture token
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_status TEXT CHECK (sync_status IN ('success', 'error', 'in_progress')) DEFAULT 'success',
  error_message TEXT,
  records_synced INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(connection_id, sync_type)
);

-- QuickBooks customers
CREATE TABLE qb_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qb_customer_id TEXT UNIQUE NOT NULL, -- QB internal ID
  qb_sync_token TEXT, -- For change tracking
  
  -- Customer information
  name TEXT NOT NULL,
  display_name TEXT,
  company_name TEXT,
  
  -- Contact details
  email TEXT,
  phone TEXT,
  mobile TEXT,
  fax TEXT,
  website TEXT,
  
  -- Billing address
  billing_address JSONB, -- {line1, line2, city, state, postal_code, country}
  
  -- Shipping address
  shipping_address JSONB,
  
  -- Financial details
  payment_terms TEXT,
  credit_limit DECIMAL(12,2),
  tax_exempt BOOLEAN DEFAULT FALSE,
  
  -- Status and settings
  is_active BOOLEAN DEFAULT TRUE,
  preferred_delivery_method TEXT,
  
  -- QB metadata
  qb_created_time TIMESTAMPTZ,
  qb_last_updated_time TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for QB sync performance
CREATE INDEX idx_qb_customers_qb_id ON qb_customers(qb_customer_id);
CREATE INDEX idx_qb_customers_sync_token ON qb_customers(qb_sync_token);
CREATE INDEX idx_qb_customers_last_synced ON qb_customers(last_synced_at);

-- QB Items that don't exist in our products table
CREATE TABLE qb_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qb_item_id TEXT UNIQUE NOT NULL,
  qb_sync_token TEXT,
  
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  type TEXT, -- 'Inventory', 'NonInventory', 'Service'
  
  -- Pricing
  unit_price DECIMAL(10,4),
  
  -- QB references
  income_account_ref TEXT,
  expense_account_ref TEXT,
  
  -- Inventory tracking
  track_quantity BOOLEAN DEFAULT FALSE,
  quantity_on_hand DECIMAL(10,4),
  
  is_active BOOLEAN DEFAULT TRUE,
  qb_created_time TIMESTAMPTZ,
  qb_last_updated_time TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Orders from QuickBooks
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  
  -- QuickBooks integration
  qb_po_id TEXT UNIQUE, -- If created in QB first
  qb_estimate_id TEXT, -- If converted from estimate
  qb_sync_token TEXT,
  
  -- Customer information
  customer_id UUID REFERENCES qb_customers(id),
  customer_name TEXT NOT NULL, -- Denormalized for performance
  
  -- PO details
  status TEXT CHECK (status IN (
    'draft', 'pending', 'approved', 'in_progress', 'completed', 'shipped', 'cancelled'
  )) DEFAULT 'pending',
  
  -- Dates
  po_date DATE NOT NULL,
  due_date DATE,
  ship_date DATE,
  
  -- Addresses
  billing_address JSONB,
  shipping_address JSONB,
  
  -- Financial totals
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  shipping_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Terms and conditions
  payment_terms TEXT,
  shipping_terms TEXT,
  
  -- Special instructions
  customer_notes TEXT,
  internal_notes TEXT,
  special_instructions TEXT,
  
  -- Priority and urgency
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5), -- 1=urgent, 5=low
  rush_order BOOLEAN DEFAULT FALSE,
  
  -- QB metadata
  qb_created_time TIMESTAMPTZ,
  qb_last_updated_time TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PO line items
CREATE TABLE po_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  
  -- Product/Item reference
  product_id UUID REFERENCES products(id), -- Our internal product
  qb_item_id TEXT, -- QuickBooks item reference
  
  -- Item details
  item_name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  
  -- Quantities
  quantity INTEGER NOT NULL,
  unit_of_measure TEXT DEFAULT 'each',
  
  -- Pricing
  unit_price DECIMAL(10,4) NOT NULL,
  line_total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  -- Screen printing specifications
  print_specifications JSONB, -- {colors, locations, artwork_url, etc.}
  
  -- Production details
  estimated_production_hours DECIMAL(6,2),
  special_instructions TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(po_id, line_number)
);

-- Indexes for performance
CREATE INDEX idx_purchase_orders_customer ON purchase_orders(customer_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_due_date ON purchase_orders(due_date);
CREATE INDEX idx_purchase_orders_qb_id ON purchase_orders(qb_po_id);

-- Add triggers
CREATE TRIGGER update_qb_connections_updated_at BEFORE UPDATE ON qb_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qb_customers_updated_at BEFORE UPDATE ON qb_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE qb_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_line_items ENABLE ROW LEVEL SECURITY;

-- Only admins can manage QB connections
CREATE POLICY "Admins can manage QB connections" ON qb_connections
  FOR ALL USING (public.is_admin());

CREATE POLICY "Admins can view sync status" ON qb_sync_status
  FOR SELECT USING (public.is_admin());

-- All authenticated users can view customers
CREATE POLICY "Users can view customers" ON qb_customers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage customers" ON qb_customers
  FOR ALL USING (public.is_admin());

-- All authenticated users can view items
CREATE POLICY "Users can view QB items" ON qb_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage QB items" ON qb_items
  FOR ALL USING (public.is_admin());

-- Purchase order policies
CREATE POLICY "Users can view purchase orders" ON purchase_orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can create/update purchase orders" ON purchase_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can view PO line items" ON po_line_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage PO line items" ON po_line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );