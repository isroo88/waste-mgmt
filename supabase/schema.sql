-- ============================================================
-- Waste Management Recycling Pvt. Ltd — Database Schema
-- Run this in Supabase SQL Editor (Project: your waste-mgmt project)
-- ============================================================

-- 1. USERS (app-level roles, linked to Supabase Auth)
-- We use Supabase Auth for login, and this table to store role + profile info.
create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text not null,
  role text not null check (role in ('admin', 'staff')),
  status text not null default 'active' check (status in ('active', 'deactivated')),
  created_at timestamptz default now()
);

-- 2. CUSTOMERS
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  address text not null,
  area text not null check (area in ('ward-10', 'ward-14', 'ward-15')),
  house_number text,
  monthly_fee numeric(10,2) not null check (monthly_fee >= 0),
  registration_date date not null default current_date,
  payment_start_date date not null,
  registered_by uuid not null references app_users(id),
  status text not null default 'active' check (status in ('active', 'deactivated')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_customers_registered_by on customers(registered_by);
create index idx_customers_area on customers(area);
create index idx_customers_status on customers(status);

-- 3. BILLS (invoice generated for a customer, before payment is collected)
create table bills (
  id uuid primary key default gen_random_uuid(),
  bill_number text unique not null,
  customer_id uuid not null references customers(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  period_label text not null, -- e.g. "2082 Baisakh - Ashadh" (BS months covered)
  generated_by uuid not null references app_users(id),
  generated_date date not null default current_date,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'cancelled')),
  created_at timestamptz default now()
);

create index idx_bills_customer on bills(customer_id);
create index idx_bills_status on bills(status);

-- 4. PAYMENTS
create table payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  bill_id uuid references bills(id),
  amount numeric(10,2) not null check (amount >= 0),
  payment_date date not null default current_date,
  collected_by uuid not null references app_users(id),
  bill_reference text,
  created_at timestamptz default now()
);

create index idx_payments_customer on payments(customer_id);
create index idx_payments_collected_by on payments(collected_by);
create index idx_payments_date on payments(payment_date);

-- 5. FEE CHANGE LOG (every fee change, instant or approved)
create table fee_change_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  changed_by uuid not null references app_users(id),
  old_fee numeric(10,2) not null,
  new_fee numeric(10,2) not null,
  change_type text not null check (change_type in ('instant_increase', 'instant_decrease_admin', 'approved_decrease')),
  created_at timestamptz default now()
);

create index idx_fee_log_customer on fee_change_log(customer_id);

-- 6. FEE DECREASE REQUESTS (staff -> admin approval flow)
create table fee_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  requested_by uuid not null references app_users(id),
  current_fee numeric(10,2) not null,
  requested_fee numeric(10,2) not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references app_users(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create index idx_fee_requests_status on fee_requests(status);
create index idx_fee_requests_customer on fee_requests(customer_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table app_users enable row level security;
alter table customers enable row level security;
alter table bills enable row level security;
alter table payments enable row level security;
alter table fee_change_log enable row level security;
alter table fee_requests enable row level security;

-- Helper: read the caller's role/status from app_users
create or replace function auth_role() returns text as $$
  select role from app_users where id = auth.uid();
$$ language sql stable security definer;

create or replace function auth_is_admin() returns boolean as $$
  select role = 'admin' from app_users where id = auth.uid();
$$ language sql stable security definer;

-- APP_USERS policies
create policy "users can read their own row" on app_users
  for select using (auth.uid() = id or auth_is_admin());

create policy "only admin can insert users" on app_users
  for insert with check (auth_is_admin());

create policy "only admin can update users" on app_users
  for update using (auth_is_admin());

-- CUSTOMERS policies
create policy "all active staff/admin can read customers" on customers
  for select using (auth.uid() is not null);

create policy "staff/admin can insert customers" on customers
  for insert with check (auth.uid() is not null and registered_by = auth.uid());

create policy "owner staff or admin can update customers" on customers
  for update using (auth_is_admin() or registered_by = auth.uid());

-- BILLS policies
create policy "all logged in can read bills" on bills
  for select using (auth.uid() is not null);

create policy "all logged in can insert bills" on bills
  for insert with check (auth.uid() is not null and generated_by = auth.uid());

create policy "all logged in can update bills" on bills
  for update using (auth.uid() is not null);

-- PAYMENTS policies
create policy "all logged in can read payments" on payments
  for select using (auth.uid() is not null);

create policy "all logged in can insert payments" on payments
  for insert with check (auth.uid() is not null and collected_by = auth.uid());

-- FEE CHANGE LOG policies
create policy "all logged in can read fee log" on fee_change_log
  for select using (auth.uid() is not null);

create policy "all logged in can insert fee log" on fee_change_log
  for insert with check (auth.uid() is not null);

-- FEE REQUESTS policies
create policy "all logged in can read fee requests" on fee_requests
  for select using (auth.uid() is not null);

create policy "staff can create their own fee requests" on fee_requests
  for insert with check (requested_by = auth.uid());

create policy "only admin can update fee requests" on fee_requests
  for update using (auth_is_admin());

-- ============================================================
-- SEED: create your first admin manually after creating the
-- Supabase Auth user via the Auth tab, then run:
-- insert into app_users (id, username, full_name, role, status)
-- values ('<auth-user-uuid>', 'admin', 'Admin Name', 'admin', 'active');
-- ============================================================
