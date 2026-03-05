-- db/migrations/10_order_stock_trigger.sql
-- Automatically manage product stock based on order lifecycle.
-- Using SECURITY DEFINER so the trigger can update products even when
-- called from a non-admin user context (bypasses RLS on products table).

CREATE OR REPLACE FUNCTION handle_order_stock_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Deduct stock on new reservation (any non-cancelled status)
    IF NEW.order_status != 'cancelled' THEN
      UPDATE products
      SET stock = GREATEST(stock - NEW.quantity, 0)
      WHERE id = NEW.product_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Order cancelled: restore stock
    IF NEW.order_status = 'cancelled' AND OLD.order_status != 'cancelled' THEN
      UPDATE products
      SET stock = stock + OLD.quantity
      WHERE id = NEW.product_id;
    END IF;

    -- Order un-cancelled (edge case): deduct stock again
    IF OLD.order_status = 'cancelled' AND NEW.order_status != 'cancelled' THEN
      UPDATE products
      SET stock = GREATEST(stock - NEW.quantity, 0)
      WHERE id = NEW.product_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    -- Restore stock when order is deleted (unless it was already cancelled)
    IF OLD.order_status != 'cancelled' THEN
      UPDATE products
      SET stock = stock + OLD.quantity
      WHERE id = OLD.product_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS manage_order_stock ON orders;
CREATE TRIGGER manage_order_stock
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_stock_changes();
