# Newsletter Email System for Announcements

This system automatically sends emails to newsletter subscribers whenever a new announcement is created.

## Quick Start (No CLI Installation Required!)

**Everything can be done directly in the Supabase Dashboard:**

1. ✅ Run SQL to create tables (SQL Editor)
2. ✅ Create Edge Function (Edge Functions section)
3. ✅ Add environment secrets (Project Settings)
4. ✅ Set up cron job (SQL Editor)

No need to install anything on your machine!

---

## Components

1. **Database Tables** (`db/newsletter.sql`)
   - `newsletter_subscribers`: Stores email addresses of newsletter subscribers
   - `announcement_email_queue`: Queue system for emails to be sent

2. **Edge Function** (`supabase/functions/send-announcement-emails/`)
   - Processes the email queue and sends emails via Gmail SMTP

3. **Frontend Integration** (`AppFooter.vue`)
   - Newsletter subscription form

## Setup Instructions (Supabase Dashboard Only)

### 1. Create Database Tables

1. Open your Supabase Dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **New query**
4. Copy the entire content from `db/newsletter.sql` and paste it
5. Click **Run** or press `Ctrl+Enter`

This creates:

- `newsletter_subscribers` table
- `announcement_email_queue` table
- All necessary triggers and policies

### 2. Create the Edge Function (Using Supabase Dashboard)

**Steps:**

1. In your Supabase Dashboard, click **Edge Functions** in the left sidebar
2. Click **Create a new function** (or **+ New Function**)
3. Function name: `send-announcement-emails`
4. In the code editor, **delete all default code** and paste the entire content from:

   ```
   supabase/functions/send-announcement-emails/index.ts
   ```

5. Click **Deploy** (bottom right)
6. Wait for deployment to complete (you'll see a success message)

> 💡 The function will appear in your Edge Functions list after deployment

**Alternative: Using Supabase CLI** (if you prefer command line)

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy send-announcement-emails
```

### 3. Set Environment Variables (Using Dashboard)

**In Supabase Dashboard:**

1. Go to **Project Settings** → **Edge Functions**
2. Scroll to **Secrets** section
3. Add the following secrets one by one:
   - **Name:** `GMAIL_USER` | **Value:** `your_email`
   - **Name:** `GMAIL_APP_PASSWORD` | **Value:** `your_gmail_app_password`
   - **Name:** `SMTP_FROM` | **Value:** `your_email`

4. Click **Save** after adding each secret

> Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Edge Functions.

### 4. Set up a Cron Job to Process Email Queue (Using Dashboard)

**Using Supabase SQL Editor:**

1. Go to **SQL Editor** in your Supabase Dashboard
2. Click **New query**
3. Paste this SQL (replace with your actual values):

```sql
-- First, enable the pg_cron and http extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Then create the cron job to run every 5 minutes
SELECT cron.schedule(
  'send-announcement-emails',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    extensions.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-announcement-emails',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
```

**To get your Service Role Key:**

1. Go to **Project Settings** → **API**
2. Copy the `service_role` key (keep this secret!)
3. Replace `YOUR_SERVICE_ROLE_KEY` in the SQL above

**To verify the cron job is running:**

```sql
-- View all cron jobs
SELECT * FROM cron.job;

-- View cron job execution history
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

**Manual Trigger Option:**

You can also manually trigger email sending from the Supabase Dashboard:

1. Go to **Edge Functions**
2. Find `send-announcement-emails`
3. Click **Invoke** or **Run**

Or trigger it via the admin panel using the `useNewsletter` composable:

```typescript
const { triggerEmailSending } = useNewsletter()
await triggerEmailSending()
```

## How It Works

1. **User subscribes** via the newsletter form in the footer
2. Email is saved to `newsletter_subscribers` table
3. **Admin creates a new announcement**
4. Database trigger automatically creates entries in `announcement_email_queue` for all active subscribers
5. **Edge Function processes the queue** (via cron job or manual trigger)
6. Emails are sent via Gmail SMTP
7. Queue items are marked as sent with timestamp

---

## Finding Everything in Supabase Dashboard

Here's where to find each feature:

| Feature             | Location in Dashboard                                       |
| ------------------- | ----------------------------------------------------------- |
| SQL Editor          | `Database` → `SQL Editor`                                   |
| Tables/Data         | `Database` → `Tables`                                       |
| Edge Functions      | `Edge Functions` (left sidebar)                             |
| Environment Secrets | `Project Settings` → `Edge Functions` → Scroll to "Secrets" |
| Service Role Key    | `Project Settings` → `API` → Look for "service_role"        |
| Cron Jobs           | View via SQL Editor: `SELECT * FROM cron.job;`              |

---

## Testing

### Test Newsletter Subscription

1. Open your app footer
2. Enter an email address
3. Click Subscribe
4. Check the `newsletter_subscribers` table in Supabase

### Test Email Sending

1. Create a new announcement as admin
2. Check the `announcement_email_queue` table - should have entries
3. Manually trigger the Edge Function or wait for cron job
4. Check email inbox for the announcement email
5. Verify queue items are marked as `sent: true`

## Monitoring

Check email queue status:

```sql
-- View pending emails
SELECT * FROM announcement_email_queue WHERE sent = false;

-- View sent emails
SELECT * FROM announcement_email_queue WHERE sent = true ORDER BY sent_at DESC;

-- View emails with errors
SELECT * FROM announcement_email_queue WHERE sent = true AND error IS NOT NULL;

-- Count subscribers
SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = true;
```

## Unsubscribe Handling

Users can unsubscribe by clicking the unsubscribe link in the email. You may want to create an unsubscribe page:

```typescript
// Example unsubscribe handler
const handleUnsubscribe = async (email: string) => {
  await supabase
    .from('newsletter_subscribers')
    .update({
      is_active: false,
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('email', email)
}
```

## Troubleshooting

### Emails not sending?

1. Check SMTP credentials are correct
2. Verify Gmail App Password is valid
3. Check Edge Function logs: `supabase functions logs send-announcement-emails`
4. Ensure the email queue has entries

### Gmail SMTP Issues?

- Make sure you're using an App Password, not your regular Gmail password
- Enable 2-factor authentication on your Gmail account
- Generate a new App Password if needed: <https://myaccount.google.com/apppasswords>

### Rate Limits

- Gmail SMTP has sending limits (500 emails/day for free accounts)
- The Edge Function processes 50 emails per run to avoid timeouts
- For larger lists, consider using a dedicated email service (SendGrid, Mailgun, etc.)
