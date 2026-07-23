# PharmaPlus — Online Pharmacy Management & E-Commerce System

A full-stack pharmacy e-commerce platform built with React, Supabase, and Paystack.

## Tech Stack
- **Frontend:** React 18 + Vite, React Router v6, TailwindCSS, Zustand, TanStack Query
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime, Row Level Security)
- **Payments:** Paystack (primary, Ghana mobile money + cards) with Stripe fallback

## Setup Instructions

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com), create a new project, and note your project URL and anon key.

### 2. Run the database migrations
In the Supabase SQL Editor, run the files in order:
1. `supabase/migrations/001_schema.sql` — creates all tables, enums, triggers, RLS policies, and seed data
2. Create a Storage bucket named `prescriptions` (Storage → New bucket → set Public: **OFF**)
3. `supabase/migrations/002_storage.sql` — sets up storage access policies

### 3. Enable Google OAuth (optional)
In Supabase Dashboard → Authentication → Providers → Google, add your OAuth credentials.

### 4. Configure environment variables
```bash
cp .env.example .env
```
Fill in:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxx
```

> Note: if `VITE_PAYSTACK_PUBLIC_KEY` is left empty, checkout falls back to a "dev mode" that marks orders as paid immediately — useful for local testing without a Paystack account.

### 5. Install and run
```bash
npm install
npm run dev
```

### 6. Create your first admin/pharmacist account
Sign up normally through the app (becomes a `customer` by default), then in the Supabase SQL Editor run:
```sql
UPDATE profiles SET role = 'admin' WHERE id = 'your-user-uuid';
```
You can find your user's UUID in Authentication → Users, or query `SELECT id, full_name FROM profiles;`

Once you have one admin account, you can promote other users to `pharmacist` or `admin` directly from **Admin Panel → Users** in the app.

## Test Accounts Flow
1. Sign up as a customer at `/auth`
2. Browse `/shop`, add prescription and non-prescription items to cart
3. Checkout — upload a prescription image if required
4. Promote your account to `pharmacist` via SQL (see above) to access `/pharmacist` and approve the prescription
5. Promote to `admin` to access `/admin` for full platform management

## Project Structure
```
pharmaplus/
├── supabase/migrations/       SQL schema, RLS policies, storage setup
├── src/
│   ├── lib/supabase.js        Supabase client singleton
│   ├── store/                 Zustand stores (auth, cart)
│   ├── components/
│   │   ├── layout/             StorefrontLayout, DashboardLayout
│   │   ├── ui/                  Shared UI primitives (Modal, Spinner, badges)
│   │   └── pharmacy/            ProductCard
│   └── pages/
│       ├── (public)             Home, Shop, Product, Cart, Checkout, Auth
│       ├── customer/            Account, Orders, Order Detail, Prescriptions
│       ├── pharmacist/          Dashboard, Prescription Review, Orders, Inventory
│       └── admin/               Dashboard, Products, Users, Coupons
```

## Security Notes
- All tables have Row Level Security enabled — customers can only read/write their own data
- Role checks (`customer`/`pharmacist`/`admin`) are enforced at the database level via the `get_user_role()` helper function, not just in the UI
- Prescription images are stored in a private bucket; pharmacists access them via signed URLs (1hr expiry)
- Payment confirmation should ideally be moved server-side via a Supabase Edge Function listening to Paystack webhooks (`charge.success`) rather than trusting the client-side callback alone — the current client-side confirmation in `CheckoutPage.jsx` is suitable for prototyping but for production, verify payment server-side before marking orders as paid.

## Production Checklist
- [ ] Move Paystack payment verification to a Supabase Edge Function (webhook-based, not client callback)
- [ ] Set the `prescriptions` storage bucket to private (not public) and use signed URLs everywhere
- [ ] Add email notifications via Resend/SendGrid triggered from Edge Functions on order status change
- [ ] Add rate limiting on the auth endpoints
- [ ] Set up Stripe as a fallback for international cards
- [ ] Add a CRON job (pg_cron or Edge Function) for expiry-date alerts
