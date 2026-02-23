-- db/newsletter.sql

-- Create newsletter_subscribers table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS newsletter_subscribers_email_idx ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_is_active_idx ON newsletter_subscribers(is_active);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_created_at_idx ON newsletter_subscribers(created_at DESC);

-- Policy: Anyone can subscribe (insert)
CREATE POLICY "Anyone can subscribe to newsletter"
  ON newsletter_subscribers FOR INSERT
  WITH CHECK (true);

-- Policy: Anyone can view their own subscription by email
CREATE POLICY "Anyone can view subscriptions"
  ON newsletter_subscribers FOR SELECT
  USING (true);

-- Policy: Subscribers can update their own subscription (unsubscribe)
CREATE POLICY "Anyone can update their subscription"
  ON newsletter_subscribers FOR UPDATE
  USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_newsletter_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_newsletter_subscribers_updated_at ON newsletter_subscribers;
CREATE TRIGGER update_newsletter_subscribers_updated_at
  BEFORE UPDATE ON newsletter_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION update_newsletter_updated_at();

-- Create announcement_email_queue table for tracking emails to be sent
CREATE TABLE IF NOT EXISTS announcement_email_queue (
  id BIGSERIAL PRIMARY KEY,
  announcement_id BIGINT REFERENCES announcements(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE announcement_email_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view email queue
CREATE POLICY "Only admins can view email queue"
  ON announcement_email_queue FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.jwt() ->> 'email')
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS announcement_email_queue_announcement_id_idx ON announcement_email_queue(announcement_id);
CREATE INDEX IF NOT EXISTS announcement_email_queue_sent_idx ON announcement_email_queue(sent);
CREATE INDEX IF NOT EXISTS announcement_email_queue_email_idx ON announcement_email_queue(email);

-- Create updated_at trigger for email queue
DROP TRIGGER IF EXISTS update_announcement_email_queue_updated_at ON announcement_email_queue;
CREATE TRIGGER update_announcement_email_queue_updated_at
  BEFORE UPDATE ON announcement_email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_newsletter_updated_at();

-- Function to queue emails for newsletter subscribers when new announcement is created
CREATE OR REPLACE FUNCTION queue_announcement_emails()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert email queue entries for all active subscribers
  INSERT INTO announcement_email_queue (announcement_id, email)
  SELECT NEW.id, email
  FROM newsletter_subscribers
  WHERE is_active = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically queue emails when new announcement is created
DROP TRIGGER IF EXISTS on_new_announcement_queue_emails ON announcements;
CREATE TRIGGER on_new_announcement_queue_emails
  AFTER INSERT ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION queue_announcement_emails();
