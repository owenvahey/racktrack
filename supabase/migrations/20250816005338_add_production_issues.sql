-- Production issues tracking table
CREATE TABLE production_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_route_id UUID REFERENCES job_routes(id),
  job_id UUID REFERENCES jobs(id),
  issue_type VARCHAR(50) NOT NULL CHECK (issue_type IN ('raw_material', 'process', 'equipment', 'other')),
  severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  
  -- Issue details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  root_cause TEXT,
  resolution TEXT,
  
  -- Material tracking (for raw material issues)
  material_product_id UUID REFERENCES products(id),
  lot_number VARCHAR(100),
  supplier_info TEXT,
  
  -- Process tracking
  work_center_id UUID REFERENCES work_centers(id),
  activity_id UUID REFERENCES activities(id),
  operator_id UUID REFERENCES auth.users(id),
  
  -- Metrics
  quantity_affected INTEGER,
  downtime_minutes INTEGER,
  cost_impact DECIMAL(10,2),
  
  -- Timestamps and tracking
  reported_by UUID REFERENCES auth.users(id),
  reported_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Issue attachments (photos, documents)
CREATE TABLE issue_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES production_issues(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_type VARCHAR(50),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Issue comments/updates
CREATE TABLE issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES production_issues(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_production_issues_job_route ON production_issues(job_route_id);
CREATE INDEX idx_production_issues_job ON production_issues(job_id);
CREATE INDEX idx_production_issues_type ON production_issues(issue_type);
CREATE INDEX idx_production_issues_status ON production_issues(status);
CREATE INDEX idx_production_issues_reported_at ON production_issues(reported_at);
CREATE INDEX idx_production_issues_material ON production_issues(material_product_id) WHERE material_product_id IS NOT NULL;

-- Enable RLS
ALTER TABLE production_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Production issues are viewable by authenticated users" ON production_issues
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Production issues can be created by authenticated users" ON production_issues
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Production issues can be updated by authenticated users" ON production_issues
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Issue attachments are viewable by authenticated users" ON issue_attachments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Issue attachments can be created by authenticated users" ON issue_attachments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Issue comments are viewable by authenticated users" ON issue_comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Issue comments can be created by authenticated users" ON issue_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Function to update updated_at timestamp
CREATE TRIGGER update_production_issues_updated_at BEFORE UPDATE ON production_issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for issue analytics
CREATE VIEW production_issue_analytics AS
SELECT 
  issue_type,
  severity,
  status,
  COUNT(*) as issue_count,
  AVG(downtime_minutes) as avg_downtime,
  SUM(quantity_affected) as total_quantity_affected,
  SUM(cost_impact) as total_cost_impact,
  DATE_TRUNC('day', reported_at) as report_date
FROM production_issues
GROUP BY issue_type, severity, status, DATE_TRUNC('day', reported_at);

-- View for material issue tracking
CREATE VIEW material_issue_summary AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.sku,
  pi.lot_number,
  COUNT(pi.id) as issue_count,
  MAX(pi.reported_at) as last_issue_date,
  SUM(pi.quantity_affected) as total_affected
FROM production_issues pi
JOIN products p ON pi.material_product_id = p.id
WHERE pi.issue_type = 'raw_material'
GROUP BY p.id, p.name, p.sku, pi.lot_number;