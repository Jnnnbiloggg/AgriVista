-- Migration: 06_reset_confirmed_orders_to_pending.sql
-- Date: 2026-02-26
--
-- Context:
--   Previously, stock was only deducted when an admin changed an order status
--   to 'confirmed'. The workflow has been updated so that stock is now
--   auto-deducted immediately when a user creates a reservation (pending).
--   The 'confirmed' action has been removed from the admin UI.
--
-- This migration:
--   1. Resets any existing 'confirmed' orders back to 'pending' so they are
--      visible and actionable under the new workflow.
--   2. Note: Stock was already decremented when those orders were confirmed,
--      so NO stock adjustment is needed here — the existing stock levels
--      remain correct.

UPDATE orders
SET
  order_status = 'pending',
  updated_at   = NOW()
WHERE order_status = 'confirmed';
