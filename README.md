# Waste Management Recycling Pvt. Ltd — Operations System

A customer management & billing system for two roles: Admin and Staff.

## Tech Stack
- **Next.js** (Pages Router, inline styles) — frontend
- **Supabase** — database + authentication
- **Vercel** — hosting
- **GitHub** — version control, auto-deploys to Vercel

## Setup Steps

### 1. Supabase Project
1. Create a new project at supabase.com (name it whatever you like internally).
2. Go to the SQL Editor and run the entire contents of `supabase/schema.sql`. This creates all tables, indexes, and Row Level Security policies.
3. Go to Authentication → Providers, and make sure Email is enabled (it is by default). You can disable "Confirm email" under Authentication → Settings to skip email verification, since staff logins use fake internal emails (see below).
4. Go to Project Settings → API and copy your **Project URL** and **anon public key**.

### 2. Local Setup
1. Copy `.env.local.example` to `.env.local` and paste in your Supabase URL and anon key.
2. Run `npm install`
3. Run `npm run dev` to test locally at `http://localhost:3000`

### 3. Create Your First Admin
Since you can't create the first user through the app (Users page requires being logged in as admin already), do this manually once:
1. In Supabase, go to Authentication → Users → Add User. Use an email like `admin@wastemgmt.local` and set a password.
2. Copy the generated user's UUID.
3. In the SQL Editor, run:
   ```sql
   insert into app_users (id, username, full_name, role, status)
   values ('PASTE-UUID-HERE', 'admin', 'Your Name', 'admin', 'active');
   ```
4. Now log into the app with username `admin` and the password you set.

After that, you can create additional staff/admin accounts directly from the **Users** page in the app (admin only).

**Important note on the Username login system:** since Supabase Auth requires an email, the app silently converts usernames to `username@wastemgmt.local` behind the scenes. Staff never see or need to know this — they just type a username and password.

### 4. Deploy
1. Push this project to a new GitHub repository.
2. Go to vercel.com, import the repository.
3. In Vercel's project settings, add the same two environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy. Vercel will auto-redeploy on every push to your main branch going forward.

## How the System Works

**Roles:**
- **Staff** register customers, log payments, generate bills, and can edit fees only for customers they personally registered. Increasing a fee is instant; decreasing one creates a request that an admin must approve.
- **Admin** sees everything company-wide, can edit any customer's fee directly, approves/rejects fee-decrease requests, and manages staff accounts.

**Customer status colors** (calculated automatically from last payment date):
- 🟢 Green — paid within the last 6 months
- 🟡 Yellow — 6–12 months since last payment
- 🔴 Red — 12+ months since last payment

**Dates:** Stored internally as standard AD dates (for reliable sorting/filtering), but displayed everywhere in BS (Nepali calendar) format. Date inputs accept BS directly.

**Billing vs Payments:** Billing generates an invoice (`bills` table, status unpaid/paid). Payments records the actual money received against a specific bill, which then marks that bill as paid.

## Known Limitations / Next Steps to Harden

1. **User creation runs client-side** in `pages/users.js` using `supabase.auth.signUp`. This works, but technically it briefly signs in as the newly created user in the browser session before reloading. For a more robust setup down the line, move this to a Next.js API route using the Supabase **service role key** (never expose this key in frontend code).
2. **No SMS/WhatsApp reminders yet** — discussed as a future add-on.
3. **No printable PDF receipts/invoices yet** — currently bills and payments are just database records.
4. **No customer self-lookup page** — intentionally skipped per your decision to keep this internal-only for now.
"# waste-mgmt" 
