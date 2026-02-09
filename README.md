# AgriVista

A simple admin + user web app for managing announcements, activities, products, trainings and feedback.

## Supabase Configuration

This project uses Supabase for authentication and database management. Follow these steps to set up Supabase.

### 1. Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-public-key
VITE_ADMIN_EMAILS=admin@example.com,admin2@example.com
```

- `VITE_SUPABASE_URL`: Your Supabase project URL (found in Project Settings → API)
- `VITE_SUPABASE_KEY`: Your Supabase anon/public key (found in Project Settings → API)
- `VITE_ADMIN_EMAILS`: Comma-separated list of email addresses that have admin access

### 2. Google OAuth Setup

Google OAuth is available for **regular users only** (admins must sign in with email/password for security).

#### Step 2.1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **OAuth consent screen**
   - Choose **External** or **Internal** based on your needs
   - Fill in the required fields:
     - App name: `AgriVista`
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes: `email`, `profile`, `openid`
   - Save and continue
4. Navigate to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth client ID**
6. Select **Web application**
7. Configure the OAuth client:
   - **Name**: `AgriVista Web Client`
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (for development)
     - `https://your-production-domain.com` (for production)
   - **Authorized redirect URIs**:
     - `https://your-project.supabase.co/auth/v1/callback`
8. Click **Create** and copy the **Client ID** and **Client Secret**

#### Step 2.2: Configure Supabase Authentication

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and click to expand
5. Toggle **Enable Sign in with Google** to ON
6. Paste your **Client ID** (from Google Cloud Console)
7. Paste your **Client Secret** (from Google Cloud Console)
8. Click **Save**

#### Step 2.3: Configure Redirect URLs in Supabase

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your app URL:
   - Development: `http://localhost:5173`
   - Production: `https://your-production-domain.com`
3. Add **Redirect URLs**:
   - `http://localhost:5173/auth/callback`
   - `https://your-production-domain.com/auth/callback`
4. Save changes

### 3. Authentication Flow

- **Regular Users**: Can sign in using Google OAuth or email/password
- **Admin Users**: Must sign in using email/password only (no Google OAuth for security)
- Admin access is determined by the `VITE_ADMIN_EMAILS` environment variable

---

## Notifications

- **Recipients:** Notifications are delivered to authenticated users and to administrators. System-generated notifications include:
  - announcements and product/training/activity updates for users who are signed in,
  - new feedback, system alerts, and admin-only events for administrators.
- **Instances:** Notifications are surfaced in the app in two primary places:
  - UI components: `src/components/shared/NotificationMenu.vue` (persistent list) and `src/components/shared/AppSnackbar.vue` (transient toasts).
  - Backend / persistence: the notification records are stored in the `db/notifications.sql` schema and surfaced by the composable `src/composables/useNotifications.ts`.

## Database / SQL Files

- **Location:** `db/` contains SQL schema and seed helpers for local or dev imports.
- **Files and purpose:**
  - `db/activities.sql`: schema / seeds for activities module
  - `db/announcements.sql`: schema / seeds for announcements
  - `db/carousel.sql`: schema / seeds for homepage carousel items
  - `db/feedbacks.sql`: schema / seeds for feedback messages submitted by users
  - `db/notifications.sql`: schema / seeds for notification records used by the app
  - `db/products.sql`: schema / seeds for product listings
  - `db/trainings.sql`: schema / seeds for training events

## Where to Look in the Code

- **Notification UI:** `src/components/shared/NotificationMenu.vue` and `src/components/shared/AppSnackbar.vue`.
- **Notification logic:** `src/composables/useNotifications.ts` for fetching/managing notifications.
- **Other related areas:** modules under `src/modules/roles/` (components and composables) implement the per-module behavior for announcements, activities, products and trainings.
