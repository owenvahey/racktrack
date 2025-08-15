# PRD 003: QuickBooks Integration & Job Management Module

## Overview
Implement comprehensive QuickBooks Online integration for importing customer POs, creating jobs, and generating invoices automatically when jobs are completed or shipped.

## Technical Requirements

### Tech Stack
- **Frontend**: Next.js 14+ with App Router, TypeScript, Tailwind CSS
- **Backend**: Supabase Edge Functions (Deno runtime)
- **Integration**: QuickBooks Online API v3
- **Authentication**: OAuth 2.0 for QuickBooks
- **Scheduling**: Supabase Cron jobs
- **Storage**: Supabase for QB tokens and sync data

### Database Schema

#### QuickBooks Configuration
```sql
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
```

#### Customer Management (QB Sync)
```sql
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
```

#### Items/Products Sync
```sql
-- Extend products table for QB integration
ALTER TABLE products ADD COLUMN qb_item_id TEXT UNIQUE;
ALTER TABLE products ADD COLUMN qb_sync_token TEXT;
ALTER TABLE products ADD COLUMN qb_type TEXT; -- 'Inventory', 'NonInventory', 'Service'
ALTER TABLE products ADD COLUMN qb_income_account_ref TEXT;
ALTER TABLE products ADD COLUMN qb_expense_account_ref TEXT;
ALTER TABLE products ADD COLUMN last_synced_at TIMESTAMPTZ;

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
```

#### Purchase Orders from QuickBooks
```sql
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
```

#### Job Management System
```sql
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
```

#### Invoice Management (QB Integration)
```sql
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
```

## User Stories

### QuickBooks Integration
- **As a business owner**, I want to connect my QuickBooks account so POs sync automatically
- **As an admin**, I want to configure sync frequency and monitor sync status
- **As a manager**, I want to see which POs are new and need job creation
- **As an accountant**, I want invoices created in QB automatically when jobs ship

### Job Management
- **As a production manager**, I want to create jobs from POs automatically
- **As a scheduler**, I want to assign jobs to workers and set priorities
- **As a worker**, I want to see my assigned jobs and update progress
- **As a supervisor**, I want real-time visibility into job status

### Customer Management
- **As a sales rep**, I want to see customer information synced from QuickBooks
- **As customer service**, I want to track all POs and jobs for each customer
- **As a manager**, I want to see customer profitability and order history

## Functional Requirements

### 1. QuickBooks Connection & Setup

#### QB OAuth Setup (`/admin/quickbooks/connect`)
- QuickBooks OAuth 2.0 connection flow
- Company selection and authorization
- Token storage and encryption
- Connection status monitoring
- Disconnect and reconnect functionality

#### Sync Configuration (`/admin/quickbooks/settings`)
- Sync frequency settings (hourly, daily, manual)
- Data type selection (customers, items, POs)
- Field mapping configuration
- Error notification settings
- Sync history and logs

#### Sync Status Dashboard (`/admin/quickbooks/status`)
- Real-time sync status indicators
- Last sync timestamps
- Error reporting and resolution
- Manual sync triggers
- Sync performance metrics

### 2. Customer Management (QB Synced)

#### Customer List (`/customers`)
- Searchable customer directory
- QB sync status indicators
- Customer activity summary
- Quick actions (view POs, create job)
- Export capabilities

#### Customer Detail (`/customers/[id]`)
- Complete customer information from QB
- PO history and status
- Job history and performance
- Communication log
- Financial summary (credit, payments)

### 3. Purchase Order Management

#### PO Dashboard (`/orders`)
- PO list with status filtering
- Priority indicators and rush orders
- Due date tracking
- Customer and value sorting
- Quick job creation actions

#### PO Detail (`/orders/[id]`)
- Complete PO information
- Line item details with specifications
- Job creation interface
- Customer communication log
- Shipping and billing addresses
- Print PO documents

#### PO Import/Sync (`/orders/sync`)
- Manual QB sync trigger
- Import validation and error handling
- Duplicate detection and resolution
- Batch processing status
- Sync conflict resolution

### 4. Job Management System

#### Job Dashboard (`/jobs`)
- Active jobs overview
- Status-based filtering (in progress, completed)
- Priority and due date sorting
- Resource utilization charts
- Performance metrics

#### Job Detail (`/jobs/[id]`)
- Complete job information
- Line item progress tracking
- Inventory allocation interface
- Time tracking (start/stop/pause)
- Progress percentage updates
- Quality checkpoints
- Customer communication

#### Job Creation (`/jobs/new` or from PO)
- Automatic job creation from PO
- Job splitting for large orders
- Resource estimation and allocation
- Priority and scheduling
- Production instructions
- Approval workflow

#### Job Tracking (`/jobs/[id]/track`)
- Real-time status updates
- Progress percentage tracking
- Time and material logging
- Quality control checkpoints
- Photo attachments for progress
- Mobile-optimized interface

### 5. Invoice Generation & Management

#### Invoice Dashboard (`/invoices`)
- Invoice list with status indicators
- Automatic invoice generation triggers
- QB sync status
- Payment tracking
- Overdue notifications

#### Invoice Creation
- Automatic creation when job completed/shipped
- Manual invoice creation option
- Line item generation from job items
- Tax calculation based on customer location
- Review and approval workflow
- Direct QB creation via API

#### Invoice Detail (`/invoices/[id]`)
- Complete invoice information
- Payment history
- QB sync status
- Resend/print options
- Customer communication log

### 6. Reporting & Analytics

#### QB Integration Reports (`/reports/quickbooks`)
- Sync performance metrics
- Data accuracy reports
- Error analysis and trends
- API usage statistics
- Connection health monitoring

#### Business Intelligence (`/reports/business`)
- Customer profitability analysis
- Job performance metrics
- Inventory turnover rates
- Production efficiency reports
- Revenue recognition tracking

## Technical Implementation Details

### Supabase Edge Functions

#### QB OAuth Handler
```typescript
// supabase/functions/qb-oauth/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { action } = await req.json()
  
  switch (action) {
    case 'authorize':
      return handleOAuthAuthorization()
    case 'callback':
      return handleOAuthCallback()
    case 'refresh':
      return refreshAccessToken()
    default:
      return new Response('Invalid action', { status: 400 })
  }
})
```

#### QB Data Sync Function
```typescript
// supabase/functions/qb-sync/index.ts
serve(async (req) => {
  const { syncType, lastToken } = await req.json()
  
  switch (syncType) {
    case 'customers':
      return await syncCustomers(lastToken)
    case 'items':
      return await syncItems(lastToken)
    case 'purchase_orders':
      return await syncPurchaseOrders(lastToken)
    default:
      return new Response('Invalid sync type', { status: 400 })
  }
})

async function syncCustomers(lastToken?: string) {
  // QB API call to get customers
  // Change data capture using lastToken
  // Upsert to qb_customers table
  // Update sync status
}
```

#### Invoice Creation Function
```typescript
// supabase/functions/create-invoice/index.ts
serve(async (req) => {
  const { jobId } = await req.json()
  
  // Get job and customer details
  // Create invoice in local database
  // Send invoice to QuickBooks
  // Update sync status
  // Send customer notification
  
  return new Response(JSON.stringify({ success: true, qbInvoiceId }))
})
```

### Frontend Components

#### QB Connection Status
```typescript
// components/quickbooks/ConnectionStatus.tsx
export function ConnectionStatus() {
  const { connection, isLoading } = useQBConnection()
  
  return (
    <div className="flex items-center space-x-2">
      <StatusIndicator status={connection?.status} />
      <span>QuickBooks: {connection?.company_name}</span>
      {connection?.last_error && (
        <ErrorTooltip error={connection.last_error} />
      )}
    </div>
  )
}
```

#### Job Creation from PO
```typescript
// components/jobs/CreateJobFromPO.tsx
interface CreateJobFromPOProps {
  po: PurchaseOrder
  onJobCreated: (job: Job) => void
}

export function CreateJobFromPO({ po, onJobCreated }: CreateJobFromPOProps) {
  // Form to create job from PO line items
  // Inventory allocation interface
  // Production planning inputs
  // Resource assignment
}
```

### Scheduled Sync (Cron Jobs)
```sql
-- Supabase Cron job for regular sync
SELECT cron.schedule(
  'qb-sync-hourly',
  '0 * * * *', -- Every hour
  $$
    SELECT net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/qb-sync',
      headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}',
      body := '{"syncType": "all"}'
    );
  $$
);
```

## Security & Compliance

### Token Management
- Encrypt QB tokens at rest
- Rotate tokens before expiration
- Secure token transmission
- Audit token usage

### Data Privacy
- Customer data encryption
- PII protection
- GDPR compliance considerations
- Data retention policies

### API Security
- Rate limiting for QB API calls
- Error handling and retry logic
- Webhook signature verification
- Secure credential storage

## Error Handling & Monitoring

### Sync Error Recovery
- Automatic retry with exponential backoff
- Error categorization and routing
- Manual intervention interface
- Sync conflict resolution

### Monitoring & Alerts
- QB API rate limit monitoring
- Sync failure notifications
- Data inconsistency detection
- Performance metric tracking

## Testing Requirements

### QB Integration Tests
- OAuth flow testing
- API response mocking
- Sync process validation
- Error scenario testing

### Job Management Tests
- Job creation workflow
- Status progression logic
- Inventory allocation
- Invoice generation triggers

## Success Criteria

### Integration Health
- ✅ 99%+ sync success rate
- ✅ <5 minute sync delays
- ✅ Zero data loss
- ✅ Automatic error recovery

### Business Process
- ✅ Automated job creation from POs
- ✅ Real-time job status tracking
- ✅ Automatic invoice generation
- ✅ Customer data synchronization

### User Experience
- ✅ Intuitive job management interface
- ✅ Clear QB connection status
- ✅ Comprehensive error messaging
- ✅ Mobile-friendly job tracking

## Dependencies
```json
{
  "dependencies": {
    "node-quickbooks": "^2.0.34",
    "oauth": "^0.10.0",
    "cron": "^3.1.6",
    "date-fns": "^2.30.0"
  }
}
```

## Environment Variables
```bash
# QuickBooks API Configuration
QB_CLIENT_ID=your_qb_app_client_id
QB_CLIENT_SECRET=your_qb_app_client_secret
QB_REDIRECT_URI=https://your-app.com/api/qb/callback
QB_SCOPE=com.intuit.quickbooks.accounting
QB_DISCOVERY_DOCUMENT=https://sandbox-quickbooks.api.intuit.com/v3/company

# Supabase Edge Function URLs
SUPABASE_QB_OAUTH_URL=https://your-project.supabase.co/functions/v1/qb-oauth
SUPABASE_QB_SYNC_URL=https://your-project.supabase.co/functions/v1/qb-sync
SUPABASE_CREATE_INVOICE_URL=https://your-project.supabase.co/functions/v1/create-invoice
```

## Deliverables

1. **Complete QuickBooks OAuth integration** with secure token management
2. **Automated PO sync system** with change data capture
3. **Comprehensive job management** with real-time tracking
4. **Automatic invoice generation** with QB integration
5. **Customer data synchronization** with conflict resolution
6. **Monitoring and error handling** with recovery mechanisms
7. **Mobile-optimized job tracking** for production floor
8. **Comprehensive reporting** for business intelligence