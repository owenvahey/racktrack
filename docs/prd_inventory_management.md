# PRD 002: Inventory Management & Barcode Scanning Module

## Overview
Implement comprehensive inventory management with barcode scanning, pallet tracking, and warehouse location management for the WMS application.

## Technical Requirements

### Tech Stack
- **Frontend**: Next.js 14+ with App Router, TypeScript, Tailwind CSS
- **Backend**: Supabase (Database + Storage + Edge Functions)
- **Barcode Scanning**: html5-qrcode or @zxing/library
- **UI Components**: Shadcn/ui
- **State Management**: Zustand + TanStack Query
- **Label Generation**: jsPDF or react-pdf

### Database Schema

#### Products Table
```sql
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
```

#### Warehouse Location Structure
```sql
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
  
  -- Generated full location code
  full_location TEXT GENERATED ALWAYS AS (
    (SELECT w.code || '-' || a.code 
     FROM warehouses w 
     JOIN aisles a ON w.id = a.warehouse_id 
     WHERE a.id = (SELECT s.aisle_id FROM shelves s WHERE s.id = shelf_id)
    ) || '-' || 
    (SELECT s.code FROM shelves s WHERE s.id = shelf_id) || '-' || code
  ) STORED,
  
  -- Capacity and dimensions
  length_cm DECIMAL(6,2),
  width_cm DECIMAL(6,2),
  height_cm DECIMAL(6,2),
  weight_capacity_kg DECIMAL(10,2),
  
  -- Current status
  is_occupied BOOLEAN DEFAULT FALSE,
  current_pallet_id UUID REFERENCES pallets(id),
  
  -- Metadata
  zone TEXT, -- 'receiving', 'storage', 'picking', 'shipping'
  temperature_controlled BOOLEAN DEFAULT FALSE,
  hazmat_approved BOOLEAN DEFAULT FALSE,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(shelf_id, code)
);

-- Index for quick location lookups
CREATE INDEX idx_storage_slots_full_location ON storage_slots(full_location);
CREATE INDEX idx_storage_slots_zone ON storage_slots(zone);
CREATE INDEX idx_storage_slots_occupied ON storage_slots(is_occupied);
```

#### Pallet Management
```sql
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
```

#### Inventory Tracking
```sql
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
```

#### Inventory Movement Audit Trail
```sql
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
```

## User Stories

### Inventory Receiving
- **As a warehouse worker**, I want to scan incoming products so they're immediately tracked in the system
- **As a receiving clerk**, I want to create new pallets and assign products to them
- **As a supervisor**, I want to see all received inventory pending quality approval
- **As a manager**, I want to track receiving performance and bottlenecks

### Inventory Management
- **As a warehouse worker**, I want to search for products by SKU or barcode quickly
- **As a picker**, I want to see real-time inventory quantities and locations
- **As a manager**, I want to set min/max stock levels and get low stock alerts
- **As an admin**, I want to perform inventory adjustments and cycle counts

### Location Management
- **As a warehouse worker**, I want to move pallets between locations easily
- **As a supervisor**, I want to see which storage slots are available
- **As a manager**, I want to optimize warehouse layout and slot utilization
- **As a system**, I want to track all inventory movements for audit purposes

### Mobile Scanning
- **As a warehouse worker**, I want to use my tablet/phone to scan barcodes efficiently
- **As a picker**, I want the scanning interface to work offline when WiFi is poor
- **As a manager**, I want all scanning activities to be logged automatically

## Functional Requirements

### 1. Product Catalog Management

#### Product List Page (`/inventory/products`)
- Searchable product catalog with filters (category, status, stock level)
- Bulk import from CSV/Excel
- Quick actions: edit, duplicate, deactivate
- Low stock indicators and alerts
- Export capabilities (CSV, PDF)

#### Product Detail/Edit Page (`/inventory/products/[id]`)
- Complete product information form
- Image upload (multiple photos)
- Barcode generation and printing
- Stock level history chart
- Related inventory locations
- Inventory movement history

#### New Product Page (`/inventory/products/new`)
- Product creation form with validation
- Automatic SKU generation option
- Barcode assignment/generation
- Category and attribute selection
- Initial stock setting

### 2. Inventory Operations

#### Inventory Dashboard (`/inventory`)
- Real-time inventory summary cards
- Low stock alerts
- Recent movements feed
- Quick action buttons (receive, move, adjust)
- Performance metrics (accuracy, velocity)

#### Receive Inventory (`/inventory/receive`)
- Barcode scanning interface
- Product lookup and validation
- Pallet assignment (new or existing)
- Location assignment
- Quality status setting
- Batch upload for multiple items

#### Inventory Search (`/inventory/search`)
- Advanced search with multiple filters
- Real-time results as you type
- Location-based filtering
- Export search results
- Save frequent searches

#### Inventory Adjustments (`/inventory/adjustments`)
- Cycle count interface
- Variance tracking
- Reason code selection
- Approval workflow for large adjustments
- Audit trail viewing

### 3. Pallet Management

#### Pallet List (`/inventory/pallets`)
- Visual pallet grid with status colors
- Search and filter capabilities
- Pallet movement history
- Location assignments
- QR code regeneration

#### Pallet Detail (`/inventory/pallets/[id]`)
- Complete pallet information
- Inventory items list with quantities
- Movement history timeline
- Location change interface
- Print pallet label
- Photo attachments

#### Create Pallet (`/inventory/pallets/new`)
- Pallet creation form
- Automatic number generation
- Initial location assignment
- Special handling flags
- QR code generation and printing

### 4. Location Management

#### Warehouse Layout (`/inventory/locations`)
- Visual warehouse map
- Interactive location grid
- Occupancy indicators
- Capacity utilization charts
- Location search and navigation

#### Location Detail (`/inventory/locations/[id]`)
- Slot information and capacity
- Current pallet assignment
- Occupancy history
- Maintenance logs
- Nearby location suggestions

#### Location Setup (`/admin/locations`)
- Add/edit aisles, shelves, slots
- Bulk location creation
- Capacity and dimension settings
- Zone assignments
- Import from layout files

### 5. Mobile Scanning Interface

#### Mobile Scanner (`/scan`)
- Camera-based barcode scanning
- Voice feedback for confirmations
- Large touch targets for warehouse gloves
- Offline capability with sync
- Quick action buttons
- Flashlight toggle for poor lighting

#### Scan Results Processing
- Instant product/pallet lookup
- Movement type selection
- Quantity input with keypad
- Location verification
- Confirmation screens
- Error handling and retry

### 6. Reporting & Analytics

#### Inventory Reports (`/inventory/reports`)
- Stock level reports by location/category
- Movement velocity analysis
- Accuracy metrics
- Aging inventory reports
- Custom report builder

#### Performance Dashboards
- Real-time KPI widgets
- Historical trend charts
- Exception reporting
- User performance metrics
- Mobile-friendly charts

## Technical Implementation Details

### File Structure
```
src/
├── app/
│   ├── inventory/
│   │   ├── page.tsx (Dashboard)
│   │   ├── products/
│   │   │   ├── page.tsx (Product list)
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── pallets/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── locations/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── receive/page.tsx
│   │   ├── search/page.tsx
│   │   ├── adjustments/page.tsx
│   │   └── reports/page.tsx
│   ├── scan/
│   │   ├── page.tsx
│   │   └── result/page.tsx
│   └── admin/
│       └── locations/page.tsx
├── components/
│   ├── inventory/
│   │   ├── ProductCard.tsx
│   │   ├── ProductForm.tsx
│   │   ├── InventoryTable.tsx
│   │   ├── StockLevelIndicator.tsx
│   │   └── MovementHistory.tsx
│   ├── scanning/
│   │   ├── BarcodeScanner.tsx
│   │   ├── ScanResult.tsx
│   │   ├── QuantityInput.tsx
│   │   └── LocationPicker.tsx
│   ├── pallets/
│   │   ├── PalletCard.tsx
│   │   ├── PalletLabel.tsx
│   │   └── PalletForm.tsx
│   └── locations/
│       ├── LocationGrid.tsx
│       ├── WarehouseMap.tsx
│       └── LocationForm.tsx
├── hooks/
│   ├── useInventory.ts
│   ├── usePallets.ts
│   ├── useLocations.ts
│   ├── useScanner.ts
│   └── useInventoryMovements.ts
├── lib/
│   ├── barcode.ts
│   ├── labelPrinting.ts
│   └── inventoryUtils.ts
└── stores/
    ├── inventoryStore.ts
    └── scanningStore.ts
```

### Barcode Scanning Implementation
```typescript
// components/scanning/BarcodeScanner.tsx
interface BarcodeScannerProps {
  onScan: (result: string) => void
  onError?: (error: string) => void
  continuous?: boolean
  cameraFacing?: 'front' | 'back'
}

export function BarcodeScanner({ 
  onScan, 
  onError, 
  continuous = false,
  cameraFacing = 'back' 
}: BarcodeScannerProps) {
  // Implementation with html5-qrcode
  // Includes camera permission handling
  // Error recovery and retry logic
  // Multiple barcode format support
  // Performance optimization for warehouse environment
}
```

### Real-time Inventory Updates
```typescript
// hooks/useInventoryUpdates.ts
export function useInventoryUpdates(filters?: InventoryFilters) {
  // Supabase real-time subscriptions
  // Optimistic updates for better UX
  // Conflict resolution for concurrent updates
  // Offline queue for mobile scanning
}
```

### Label Generation
```typescript
// lib/labelPrinting.ts
export function generatePalletLabel(pallet: Pallet): Promise<Blob> {
  // Generate PDF with QR code
  // Include pallet number, date, location
  // Optimize for thermal printers
  // Support multiple label sizes
}
```

## UI/UX Requirements

### Design System
- Consistent with authentication module
- Mobile-first responsive design
- High contrast for warehouse lighting
- Large touch targets (min 44px)
- Loading states and offline indicators

### Mobile Optimization
- Touch-optimized scanning interface
- Haptic feedback for confirmations
- Voice prompts for hands-free operation
- Flashlight integration for dark areas
- Gesture navigation support

### Accessibility
- Screen reader compatibility
- Keyboard navigation
- Voice input support
- High contrast mode
- Font size adjustments

## Performance Requirements

### Response Times
- Product search: < 500ms
- Barcode scan processing: < 1 second
- Page loads: < 2 seconds
- Real-time updates: < 100ms

### Scalability
- Support 100,000+ products
- Handle 10,000+ pallets
- Process 1,000+ movements/day
- Support 50+ concurrent scanners

### Offline Capability
- Cache recent scans
- Queue movements for sync
- Store product catalog locally
- Graceful degradation

## Security Requirements

### Data Protection
- Row-level security by warehouse
- Audit logging for all movements
- Secure file uploads
- Input validation and sanitization

### Access Control
- Role-based feature access
- Movement approval workflows
- Sensitive operation logging
- Device authentication for scanners

## Testing Requirements

### Unit Tests
- Barcode processing logic
- Inventory calculation functions
- Label generation
- Movement validation

### Integration Tests
- Real-time updates
- Scanner hardware integration
- Database transaction integrity
- File upload processing

### E2E Tests
- Complete receiving workflow
- Scanning and movement process
- Search and filtering
- Mobile device compatibility

## Success Criteria

### Functionality
- ✅ Accurate inventory tracking
- ✅ Fast barcode scanning
- ✅ Real-time location updates
- ✅ Mobile-optimized interface
- ✅ Comprehensive audit trail

### Performance
- ✅ Sub-second scan processing
- ✅ Reliable mobile operation
- ✅ 99.9% data accuracy
- ✅ Offline functionality
- ✅ Scalable architecture

### User Experience
- ✅ Intuitive scanning workflow
- ✅ Quick product lookup
- ✅ Clear visual indicators
- ✅ Minimal training required
- ✅ Error prevention/recovery

## Dependencies
```json
{
  "dependencies": {
    "html5-qrcode": "^2.3.8",
    "@tanstack/react-query": "^5.0.0",
    "jspdf": "^2.5.1",
    "qrcode": "^1.5.3",
    "react-hook-form": "^7.47.0",
    "date-fns": "^2.30.0",
    "recharts": "^2.8.0"
  }
}
```

## Deliverables

1. **Complete inventory management system** with real-time tracking
2. **Mobile barcode scanning interface** optimized for warehouse use
3. **Pallet management system** with QR code generation
4. **Warehouse location management** with visual layout
5. **Comprehensive movement tracking** with full audit trail
6. **Reporting and analytics** for inventory insights
7. **Mobile-optimized PWA** for warehouse workers
8. **Integration points** for QuickBooks sync (future module)