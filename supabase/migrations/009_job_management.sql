-- Job Management System

-- Jobs table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number TEXT UNIQUE NOT NULL, -- JOB-YYYYMMDD-### format
  
  -- Source information
  po_id UUID REFERENCES purchase_orders(id),
  customer_id UUID REFERENCES qb_customers(id),
  
  -- Job details
  job_name TEXT NOT NULL,
  description TEXT,
  
  -- Status tracking
  status TEXT CHECK (status IN (
    'created', 'planned', 'in_progress', 'review', 'completed', 'shipped', 'cancelled'
  )) DEFAULT 'created',
  
  -- Scheduling
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  estimated_start_date DATE,
  estimated_completion_date DATE,
  actual_start_date TIMESTAMPTZ,
  actual_completion_date TIMESTAMPTZ,
  
  -- Resource allocation
  assigned_to UUID REFERENCES profiles(id),
  work_center TEXT, -- 'printing', 'embroidery', 'fulfillment', etc.
  
  -- Production estimates
  estimated_hours DECIMAL(8,2),
  estimated_cost DECIMAL(12,2),
  
  -- Actual tracking
  actual_hours DECIMAL(8,2) DEFAULT 0,
  actual_cost DECIMAL(12,2) DEFAULT 0,
  
  -- Progress tracking
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  
  -- Notes and instructions
  production_notes TEXT,
  quality_requirements TEXT,
  special_instructions TEXT,
  
  -- Customer communication
  customer_approved BOOLEAN DEFAULT FALSE,
  customer_approval_date TIMESTAMPTZ,
  proof_required BOOLEAN DEFAULT FALSE,
  proof_approved BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job line items (linked to PO line items)
CREATE TABLE job_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  po_line_item_id UUID REFERENCES po_line_items(id),
  
  -- Production details
  quantity_ordered INTEGER NOT NULL,
  quantity_completed INTEGER DEFAULT 0,
  quantity_shipped INTEGER DEFAULT 0,
  
  -- Inventory allocation
  inventory_allocated JSONB, -- Array of {inventory_id, quantity}
  inventory_consumed JSONB, -- Track what was actually used
  
  -- Production tracking
  status TEXT CHECK (status IN (
    'pending', 'in_progress', 'completed', 'shipped'
  )) DEFAULT 'pending',
  
  -- Timestamps
  production_started_at TIMESTAMPTZ,
  production_completed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  
  -- Quality control
  quality_approved BOOLEAN DEFAULT FALSE,
  quality_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job activity log
CREATE TABLE job_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type TEXT NOT NULL, -- 'status_change', 'progress_update', 'note_added', etc.
  description TEXT NOT NULL,
  
  -- Old and new values for tracking changes
  old_value TEXT,
  new_value TEXT,
  
  -- User who performed the action
  performed_by UUID REFERENCES profiles(id),
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate job numbers
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  date_part TEXT;
  sequence_part TEXT;
  existing_count INTEGER;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  SELECT COUNT(*) INTO existing_count
  FROM jobs 
  WHERE job_number LIKE 'JOB-' || date_part || '-%';
  
  sequence_part := LPAD((existing_count + 1)::TEXT, 3, '0');
  new_number := 'JOB-' || date_part || '-' || sequence_part;
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate job numbers
CREATE OR REPLACE FUNCTION set_job_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
    NEW.job_number := generate_job_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_job_number
  BEFORE INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_job_number();

-- Function to log job activities
CREATE OR REPLACE FUNCTION log_job_activity()
RETURNS TRIGGER AS $$
DECLARE
  activity_desc TEXT;
  activity_type TEXT;
  old_val TEXT;
  new_val TEXT;
BEGIN
  -- Determine what changed
  IF TG_OP = 'INSERT' THEN
    activity_type := 'job_created';
    activity_desc := 'Job created';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check for status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      activity_type := 'status_change';
      activity_desc := 'Status changed from ' || OLD.status || ' to ' || NEW.status;
      old_val := OLD.status;
      new_val := NEW.status;
    -- Check for progress update
    ELSIF OLD.progress_percentage IS DISTINCT FROM NEW.progress_percentage THEN
      activity_type := 'progress_update';
      activity_desc := 'Progress updated to ' || NEW.progress_percentage || '%';
      old_val := OLD.progress_percentage::TEXT;
      new_val := NEW.progress_percentage::TEXT;
    -- Check for assignment change
    ELSIF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      activity_type := 'assignment_change';
      activity_desc := 'Job reassigned';
      old_val := OLD.assigned_to::TEXT;
      new_val := NEW.assigned_to::TEXT;
    ELSE
      -- Generic update
      activity_type := 'job_updated';
      activity_desc := 'Job details updated';
    END IF;
  END IF;
  
  -- Log the activity
  INSERT INTO job_activities (
    job_id,
    activity_type,
    description,
    old_value,
    new_value,
    performed_by
  ) VALUES (
    NEW.id,
    activity_type,
    activity_desc,
    old_val,
    new_val,
    auth.uid()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_job_changes
  AFTER INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION log_job_activity();

-- Indexes for performance
CREATE INDEX idx_jobs_po_id ON jobs(po_id);
CREATE INDEX idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_assigned_to ON jobs(assigned_to);
CREATE INDEX idx_jobs_due_date ON jobs(estimated_completion_date);
CREATE INDEX idx_job_activities_job_id ON job_activities(job_id);

-- Add triggers
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_line_items_updated_at BEFORE UPDATE ON job_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_activities ENABLE ROW LEVEL SECURITY;

-- Job policies
CREATE POLICY "Users can view jobs" ON jobs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can create jobs" ON jobs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Assigned users and managers can update jobs" ON jobs
  FOR UPDATE USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete jobs" ON jobs
  FOR DELETE USING (public.is_admin());

-- Job line item policies
CREATE POLICY "Users can view job line items" ON job_line_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage job line items" ON job_line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Job activity policies
CREATE POLICY "Users can view job activities" ON job_activities
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All users can log activities" ON job_activities
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);