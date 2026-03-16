-- Migration: Add archiving capability to announcements (manually_archived)

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS manually_archived BOOLEAN DEFAULT FALSE;
