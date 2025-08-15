-- Invoice Management (QB Integration)

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  
  -- QuickBooks integration
  qb_invoice_id TEXT UNIQUE, -- QB generated ID
  qb_sync_token TEXT,
  
  -- Source references
  job_id UUID REFERENCES jobs(id),
  po_id UUID REFERENCES purchase_orders(id),
  customer_id UUID REFERENCES qb_customers(id) NOT NULL,
  
  -- Invoice details
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Financial information
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,4),
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Status
  status TEXT CHECK (status IN (
    'draft', 'sent', 'viewed', 'paid', 'overdue', 'void'
  )) DEFAULT 'draft',
  
  -- Payment tracking
  amount_paid DECIMAL(12,2) DEFAULT 0,
  balance_due DECIMAL(12,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  
  -- QB specific
  qb_doc_number TEXT, -- QB document number
  qb_private_note TEXT,
  qb_customer_memo TEXT,
  
  -- Shipping information
  shipping_date DATE,
  tracking_number TEXT,
  shipping_method TEXT,
  
  -- QB metadata
  qb_created_time TIMESTAMPTZ,
  qb_last_updated_time TIMESTAMPTZ,
  sent_to_qb_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  job_line_item_id UUID REFERENCES job_line_items(id),
  
  -- Line details
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,4) NOT NULL,
  line_total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  -- QB item reference
  qb_item_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(invoice_id, line_number)
);

-- Invoice number generation
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  sequence_part TEXT;
  existing_count INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COUNT(*) INTO existing_count
  FROM invoices 
  WHERE invoice_number LIKE 'INV-' || year_part || '-%';
  
  sequence_part := LPAD((existing_count + 1)::TEXT, 5, '0');
  new_number := 'INV-' || year_part || '-' || sequence_part;
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate invoice numbers
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

-- Function to calculate invoice totals
CREATE OR REPLACE FUNCTION calculate_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  calc_subtotal DECIMAL(12,2);
  calc_tax DECIMAL(12,2);
BEGIN
  -- Calculate subtotal from line items
  SELECT COALESCE(SUM(line_total), 0) INTO calc_subtotal
  FROM invoice_line_items
  WHERE invoice_id = NEW.id;
  
  NEW.subtotal := calc_subtotal;
  
  -- Calculate tax if rate is set
  IF NEW.tax_rate IS NOT NULL THEN
    NEW.tax_amount := ROUND(calc_subtotal * NEW.tax_rate, 2);
  END IF;
  
  -- Calculate total
  NEW.total_amount := NEW.subtotal + COALESCE(NEW.tax_amount, 0) 
                     - COALESCE(NEW.discount_amount, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate totals when line items change
CREATE OR REPLACE FUNCTION update_invoice_on_line_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the invoice to trigger total recalculation
  UPDATE invoices 
  SET updated_at = NOW()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalc_invoice_totals
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_totals();

CREATE TRIGGER update_invoice_on_line_insert
  AFTER INSERT ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_on_line_change();

CREATE TRIGGER update_invoice_on_line_update
  AFTER UPDATE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_on_line_change();

CREATE TRIGGER update_invoice_on_line_delete
  AFTER DELETE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_on_line_change();

-- Update invoice status based on due date
CREATE OR REPLACE FUNCTION update_overdue_invoices()
RETURNS void AS $$
BEGIN
  UPDATE invoices
  SET status = 'overdue'
  WHERE status IN ('sent', 'viewed')
    AND due_date < CURRENT_DATE
    AND balance_due > 0;
END;
$$ LANGUAGE plpgsql;

-- Indexes
CREATE INDEX idx_invoices_job_id ON invoices(job_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_qb_id ON invoices(qb_invoice_id);

-- Triggers
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Invoice policies
CREATE POLICY "Users can view invoices" ON invoices
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can create invoices" ON invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Managers can update invoices" ON invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete invoices" ON invoices
  FOR DELETE USING (public.is_admin());

-- Invoice line item policies
CREATE POLICY "Users can view invoice line items" ON invoice_line_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage invoice line items" ON invoice_line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );