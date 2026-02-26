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

## Recent Updates

### Archiving & Visibility

Each module uses two complementary mechanisms — **auto-archiving** (DB trigger) and **manual archiving** (admin action) — to control item visibility.

#### Auto-Archiving (DB Trigger)

| Module            | Trigger field   | How `archived_at` is calculated                                                                     |
| ----------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| **Activities**    | `archived_at`   | DB trigger: uses `end_date + end_time` if provided, otherwise `date + time + 12 hours`.             |
| **Appointments**  | `archived_at`   | DB trigger: `date + time + 12 hours`.                                                               |
| **Trainings**     | `archived_at`   | DB trigger: `end_date_time + 12 hours`.                                                             |
| **Announcements** | `visible_until` | Admin sets a duration (e.g. "3 days", "Infinite"). `visible_until` is calculated from the duration. |

> **Important:** The trigger only recalculates `archived_at` when the relevant date/time fields actually change, so toggling `manually_archived` does **not** reset the auto-archive timestamp.

#### Manual Archiving (Admin Action)

Admins can manually archive any **Activity**, **Appointment**, or **Training** at any time before the auto-archive time fires. This is useful for temporarily hiding an item (e.g., to make edits) without waiting for the scheduled auto-archive.

A new boolean column `manually_archived` (default `false`) tracks this state separately from `archived_at`.

**An item is considered archived if:**

- `archived_at ≤ NOW()` (auto-archive time has passed), **OR**
- `manually_archived = true` (admin has manually archived it)

#### Archive / Unarchive Button Rules

The following table shows exactly when each button appears for admin users in the management tables:

| Item State                                               | Archive button   | Unarchive button |
| -------------------------------------------------------- | ---------------- | ---------------- |
| Active (not archived by any means)                       | ✅ Shown (amber) | ❌ Hidden        |
| Manually archived, auto-archive time still in future     | ❌ Hidden        | ✅ Shown (green) |
| Auto-archived (end time has passed, `archived_at ≤ NOW`) | ❌ Hidden        | ❌ Hidden        |
| Manually archived **and** auto-archive time has passed   | ❌ Hidden        | ❌ Hidden        |

> Once an item is auto-archived (the scheduled time has passed), it **cannot** be unarchived — it is permanently archived by the system. Manual archiving can only be reversed while the auto-archive window is still in the future.

#### Show Archived Toggle

- Admins can toggle **Show Archived** to view past/archived items alongside the live list.
- The archived view shows items where `archived_at ≤ NOW()` **OR** `manually_archived = true`.
- Regular users only ever see active (unarchived) items.

#### Database Migration Required

Run the migration script in your **Supabase Dashboard → SQL Editor** to add the `manually_archived` column and update the triggers:

```text
db/migrations/add_manually_archived.sql
```

### Other changes

- **Activities Module:** Upgraded "My Bookings" and "My Appointments" to paginated data tables with user detail modals. Enforced a 3-day cancellation policy for both. User tables hide personal info columns (shown only to admins).
- **Products Module:** Upgraded "My Orders" to a paginated data table. Added status filters for order management. Enforced a 3-day cancellation policy and date formatting fixes. User tables hide buyer info columns (shown only to admins).
- **Trainings Module:** Enforced a 3-day cancellation policy for registrations and overhauled "My Registrations" with a paginated data table. Removed unnecessary filtering toggles. User tables hide participant info columns (shown only to admins).
- **Announcements Module:** Introduced an "infinite" duration option for announcements.
- **User Detail Modal:** When opened from the user side, the "User Information" section is hidden — only record details (Booking/Appointment/Order/Registration) are shown. Admins see both sections.

## Where to Look in the Code

- **Notification UI:** `src/components/shared/NotificationMenu.vue` and `src/components/shared/AppSnackbar.vue`.
- **Notification logic:** `src/composables/useNotifications.ts` for fetching/managing notifications.
- **Other related areas:** modules under `src/modules/roles/` (components and composables) implement the per-module behavior for announcements, activities, products and trainings.
