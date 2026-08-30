-- ============================================
-- MASTER DATA (PRD §27-29)
-- ============================================

-- COMPANIES (customer & supplier dalam satu tabel, dibedakan type)
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  company_type text not null check (company_type in ('customer', 'supplier', 'both')),
  company_name text not null,
  pic text,
  email text,
  phone text,
  address text,
  city text,
  country text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table companies enable row level security;
create policy "users manage own companies" on companies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_companies_user on companies(user_id);

-- PRODUCTS
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  product_name text not null,
  description text,
  hs_code text,
  unit text default 'PCS',
  default_unit_price numeric default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table products enable row level security;
create policy "users manage own products" on products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_products_user on products(user_id);
