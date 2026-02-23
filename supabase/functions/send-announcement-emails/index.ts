// supabase/functions/send-announcement-emails/index.ts

/**
 * NOTE: You may see TypeScript errors in VSCode for Deno imports and types.
 * This is normal! This code runs in Deno runtime, not Node.js.
 * These errors won't affect deployment to Supabase Edge Functions.
 * The code will work perfectly when deployed.
 *
 * To suppress errors locally, you can:
 * 1. Ignore them (recommended - they're cosmetic)
 * 2. Install Deno VSCode extension
 *
 * See README.md for more details.
 */

// @ts-ignore - Deno imports work in Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno imports work in Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore - Deno imports work in Supabase Edge Functions
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

// Declare Deno namespace for TypeScript
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailQueueItem {
  id: number
  announcement_id: number
  email: string
  sent: boolean
}

interface Announcement {
  id: number
  title: string
  description: string
  duration: string
  image_url: string | null
}

type ServeHandler = (req: Request) => Response | Promise<Response>

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get Gmail SMTP credentials from environment
    const gmailUser = Deno.env.get('GMAIL_USER')
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD')
    const smtpFrom = Deno.env.get('SMTP_FROM')

    if (!gmailUser || !gmailPassword || !smtpFrom) {
      throw new Error('SMTP credentials not configured')
    }

    // Initialize SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailPassword,
        },
      },
    })

    // Get pending emails from queue (limit to 50 per run to avoid timeouts)
    const { data: emailQueue, error: queueError } = await supabase
      .from('announcement_email_queue')
      .select('id, announcement_id, email, sent')
      .eq('sent', false)
      .limit(50)

    if (queueError) throw queueError

    if (!emailQueue || emailQueue.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending emails to send' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Get unique announcement IDs
    const announcementIds = [
      ...new Set(emailQueue.map((item: EmailQueueItem) => item.announcement_id)),
    ]

    // Fetch announcements
    const { data: announcements, error: announcementsError } = await supabase
      .from('announcements')
      .select('id, title, description, duration, image_url')
      .in('id', announcementIds)

    if (announcementsError) throw announcementsError

    // Create a map of announcements for quick lookup
    const announcementMap = new Map<number, Announcement>()
    announcements?.forEach((announcement: Announcement) => {
      announcementMap.set(announcement.id, announcement)
    })

    let successCount = 0
    let errorCount = 0

    // Send emails
    for (const queueItem of emailQueue as EmailQueueItem[]) {
      const announcement = announcementMap.get(queueItem.announcement_id)

      if (!announcement) {
        // Mark as error if announcement not found
        await supabase
          .from('announcement_email_queue')
          .update({
            sent: true,
            sent_at: new Date().toISOString(),
            error: 'Announcement not found',
          })
          .eq('id', queueItem.id)
        errorCount++
        continue
      }

      try {
        // Create email HTML content
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #ffffff;
      padding: 30px 20px;
      border: 1px solid #e0e0e0;
      border-top: none;
    }
    .announcement-title {
      color: #4caf50;
      font-size: 24px;
      margin-bottom: 20px;
    }
    .announcement-image {
      width: 100%;
      max-width: 560px;
      height: auto;
      margin: 20px 0;
      border-radius: 8px;
    }
    .announcement-description {
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .duration {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 20px;
      font-size: 14px;
      color: #666;
    }
    .cta-button {
      display: inline-block;
      background: #4caf50;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
    .footer {
      background: #f5f5f5;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-radius: 0 0 8px 8px;
    }
    .unsubscribe {
      color: #999;
      text-decoration: none;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🌿 New Announcement from AgriVista</h1>
  </div>
  <div class="content">
    <h2 class="announcement-title">${announcement.title}</h2>
    ${announcement.image_url ? `<img src="${announcement.image_url}" alt="${announcement.title}" class="announcement-image" />` : ''}
    <div class="announcement-description">
      ${announcement.description.replace(/\n/g, '<br>')}
    </div>
    <div class="duration">
      <strong>Duration:</strong> ${announcement.duration}
    </div>
    <a href="${supabaseUrl.replace('https://', 'https://www.')}" class="cta-button">Visit AgriVista</a>
  </div>
  <div class="footer">
    <p>You're receiving this email because you subscribed to AgriVista newsletter.</p>
    <p>
      <a href="${supabaseUrl}/unsubscribe?email=${encodeURIComponent(queueItem.email)}" class="unsubscribe">
        Unsubscribe from this newsletter
      </a>
    </p>
    <p>© ${new Date().getFullYear()} AgriVista. All rights reserved.</p>
  </div>
</body>
</html>
        `

        // Send email
        await client.send({
          from: smtpFrom,
          to: queueItem.email,
          subject: `New Announcement: ${announcement.title}`,
          content: emailHtml,
          html: emailHtml,
        })

        // Mark as sent
        await supabase
          .from('announcement_email_queue')
          .update({
            sent: true,
            sent_at: new Date().toISOString(),
            error: null,
          })
          .eq('id', queueItem.id)

        successCount++
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Error sending email to ${queueItem.email}:`, error)

        // Mark as sent with error
        await supabase
          .from('announcement_email_queue')
          .update({
            sent: true,
            sent_at: new Date().toISOString(),
            error: errorMessage,
          })
          .eq('id', queueItem.id)

        errorCount++
      }
    }

    await client.close()

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${successCount} emails, ${errorCount} errors`,
        successCount,
        errorCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in send-announcement-emails function:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
