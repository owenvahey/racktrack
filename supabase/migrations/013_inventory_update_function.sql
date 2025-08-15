-- Function to update inventory quantity
CREATE OR REPLACE FUNCTION update_inventory_quantity(
  p_inventory_id UUID,
  p_quantity_change DECIMAL(12,4),
  p_movement_type TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  new_quantity DECIMAL(12,4),
  new_available DECIMAL(12,4)
) AS $$
DECLARE
  v_current_quantity DECIMAL(12,4);
  v_reserved_quantity DECIMAL(12,4);
  v_new_quantity DECIMAL(12,4);
  v_new_available DECIMAL(12,4);
BEGIN
  -- Get current inventory
  SELECT quantity, reserved_quantity
  INTO v_current_quantity, v_reserved_quantity
  FROM inventory
  WHERE id = p_inventory_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory not found: %', p_inventory_id;
  END IF;
  
  -- Calculate new quantity
  v_new_quantity := v_current_quantity + p_quantity_change;
  
  -- Check for negative inventory
  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient inventory. Current: %, Change: %', v_current_quantity, p_quantity_change;
  END IF;
  
  -- Update inventory
  UPDATE inventory
  SET 
    quantity = v_new_quantity,
    available_quantity = v_new_quantity - reserved_quantity,
    updated_at = NOW()
  WHERE id = p_inventory_id
  RETURNING quantity, available_quantity
  INTO v_new_quantity, v_new_available;
  
  -- Log inventory movement
  INSERT INTO inventory_movements (
    inventory_id,
    movement_type,
    quantity_before,
    quantity_change,
    quantity_after,
    performed_by
  ) VALUES (
    p_inventory_id,
    p_movement_type,
    v_current_quantity,
    p_quantity_change,
    v_new_quantity,
    auth.uid()
  );
  
  RETURN QUERY SELECT TRUE, v_new_quantity, v_new_available;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_inventory_quantity TO authenticated;