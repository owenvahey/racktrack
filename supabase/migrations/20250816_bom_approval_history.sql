-- BOM Approval History table
CREATE TABLE IF NOT EXISTS bom_approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID REFERENCES product_boms(id) ON DELETE CASCADE,
  action TEXT CHECK (action IN ('approved', 'rejected', 'comment')) NOT NULL,
  comments TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add is_default column to product_boms if it doesn't exist
ALTER TABLE product_boms 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_bom_approval_history_bom_id ON bom_approval_history(bom_id);
CREATE INDEX IF NOT EXISTS idx_product_boms_is_default ON product_boms(product_id, is_default);

-- Function to ensure only one default BOM per product
CREATE OR REPLACE FUNCTION ensure_single_default_bom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    -- Remove default from other BOMs for this product
    UPDATE product_boms 
    SET is_default = FALSE 
    WHERE product_id = NEW.product_id 
    AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS ensure_single_default_bom_trigger ON product_boms;
CREATE TRIGGER ensure_single_default_bom_trigger
BEFORE INSERT OR UPDATE OF is_default ON product_boms
FOR EACH ROW
WHEN (NEW.is_default = TRUE)
EXECUTE FUNCTION ensure_single_default_bom();