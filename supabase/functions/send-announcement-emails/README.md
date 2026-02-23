# Send Announcement Emails Edge Function

This Supabase Edge Function sends newsletter emails to subscribers when new announcements are created.

## About TypeScript Errors in VSCode

**You may see TypeScript errors like "Cannot find module..." in your editor. This is normal and expected!**

### Why This Happens

- This code runs in **Deno runtime** (not Node.js)
- VSCode's TypeScript doesn't recognize Deno-style imports
- The code works perfectly when deployed to Supabase

### How to Handle Import Errors

**Option 1: Ignore them**

- The errors are cosmetic
- Code will run fine in Supabase Edge Functions
- Just deploy as-is using the Supabase Dashboard

**Option 2: Add type definitions** (Already included)

- `types.d.ts` provides basic type support
- Reduces (but may not eliminate) all errors
- Helps with autocomplete

**Option 3: Use Deno VSCode Extension**

1. Install the [Deno Extension](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno)
2. Create `.vscode/settings.json` in the function folder:

```json
{
  "deno.enable": true,
  "deno.lint": true,
  "deno.unstable": false
}
```

## Deployment

### Via Supabase Dashboard (Recommended)

1. Go to **Edge Functions** in Supabase Dashboard
2. Create new function: `send-announcement-emails`
3. Copy-paste this entire `index.ts` content
4. Click **Deploy**

### Via Supabase CLI

```bash
supabase functions deploy send-announcement-emails
```

## Environment Variables Required

Set these in **Project Settings → Edge Functions → Secrets**:

- `GMAIL_USER` - Your Gmail address
- `GMAIL_APP_PASSWORD` - Gmail app password (not regular password)
- `SMTP_FROM` - Email address to send from

## Testing

Invoke the function via:

**Supabase Dashboard:**

- Go to Edge Functions
- Click on `send-announcement-emails`
- Click **Invoke**

**Or via curl:**

```bash
curl -X POST \
  'https://YOUR_PROJECT.supabase.co/functions/v1/send-announcement-emails' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY'
```

## Monitoring

Check logs in:

- **Supabase Dashboard** → Edge Functions → Logs
- Or via CLI: `supabase functions logs send-announcement-emails`

## Common Issues

### SMTP Authentication Failed

- Verify Gmail App Password is correct
- Ensure 2FA is enabled on Gmail account
- Generate a new App Password if needed

### Emails Not Sending

- Check `announcement_email_queue` table for pending emails
- Verify cron job is running
- Check function logs for errors

### TypeScript Errors Blocking Deployment

- **They won't!** TypeScript errors in your local editor don't affect deployment
- The Supabase platform compiles and runs the code successfully
- Just ignore the red squiggles in VSCode
