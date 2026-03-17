-- db/migrations/13_drop_carousel_slides.sql

-- Drop the carousel_slides table and its policies, triggers, indexes
DROP TRIGGER IF EXISTS update_carousel_slides_updated_at ON carousel_slides;
DROP TABLE IF EXISTS carousel_slides CASCADE;

-- Note: The 'carousel' storage bucket is not automatically dropped here 
-- to prevent accidental data loss. You can remove it manually via the Supabase Dashboard.
