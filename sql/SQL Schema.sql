-- =============================================
-- PROFILES
-- =============================================
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text unique,
  full_name text,
  role text default 'customer' check (role in ('developer','customer')),
  status text default 'active' check (status in ('active','locked')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "read own profile" on profiles
  for select using (auth.uid() = id or exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'developer'));
create policy "update own profile" on profiles
  for update using (auth.uid() = id);

-- auto-create profile on signup
create function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, role, status)
  values (new.id, new.email, 'customer', 'active');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- FEATURES & ACCESS
-- =============================================
create table features (
  id uuid primary key default gen_random_uuid(),
  feature_key text unique not null,
  feature_name text not null,
  description text,
  active boolean default true,
  created_at timestamptz default now()
);

create table user_features (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  feature_id uuid references features on delete cascade,
  enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, feature_id)
);

alter table features enable row level security;
alter table user_features enable row level security;

create policy "read features" on features for select using (true);
create policy "read own features" on user_features for select
  using (auth.uid() = user_id or exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'developer'));

-- seed features
insert into features (feature_key, feature_name, active) values
('invoice','Commercial Invoice',true),
('packing_list','Packing List',true),
('purchase_order','Purchase Order',false),
('shipping_rate','Shipping Rate Checker',false),
('duty_tax','Duty & Tax Calculator',false),
('proforma_invoice','Proforma Invoice',false),
('quotation','Quotation',false),
('certificate_of_origin','Certificate of Origin',false),
('landed_cost','Landed Cost Calculator',false);

-- =============================================
-- MASTER DATA
-- =============================================
create table companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  company_name text, pic text, email text, phone text,
  address text, city text, country text, postal_code text,
  tax_id text, registration_number text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  company_name text, pic text, email text, phone text,
  address text, city text, state text, postal_code text,
  country text, tax_id text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  company_name text, pic text, email text, phone text,
  address text, city text, state text, postal_code text,
  country text, tax_id text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  sku text, name text, description text,
  hs_code text, country_of_origin text, unit text,
  default_price numeric, default_weight numeric,
  active boolean default true,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- =============================================
-- INVOICES
-- =============================================
create table invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  shipment_type text check (shipment_type in ('export','import')),
  invoice_number text unique not null,
  invoice_number_mode text default 'auto',
  invoice_date date default current_date,
  customer_id uuid references customers,
  currency text default 'USD',
  payment_terms text, incoterms text,
  po_number text, reference_number text,
  port_of_loading text, port_of_discharge text,
  final_destination text, country_of_origin text, country_of_destination text,
  awb_number text, bl_number text, container_number text,
  vessel_flight text, shipment_date date,
  subtotal numeric default 0, freight numeric default 0,
  insurance numeric default 0, other_charges numeric default 0,
  discount numeric default 0, grand_total numeric default 0,
  template_type text default 'simple',
  status text default 'draft',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices on delete cascade,
  product_id uuid references products,
  description text, sku text, hs_code text, country_of_origin text,
  quantity numeric, unit text, unit_price numeric, amount numeric,
  net_weight numeric, gross_weight numeric,
  created_at timestamptz default now()
);

create table packing_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  invoice_id uuid references invoices,
  packing_list_number text unique not null,
  packing_list_number_mode text default 'auto',
  packing_list_date date default current_date,
  template_type text default 'simple',
  status text default 'draft',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table packing_list_items (
  id uuid primary key default gen_random_uuid(),
  packing_list_id uuid references packing_lists on delete cascade,
  invoice_item_id uuid references invoice_items,
  package_number text, description text, quantity numeric, unit text,
  net_weight numeric, gross_weight numeric,
  length numeric, width numeric, height numeric, cbm numeric,
  package_type text, marks_numbers text,
  created_at timestamptz default now()
);

-- Catatan: definisi & nilai custom field TIDAK disimpan di sini.
-- Lihat "CUSTOM FIELDS (PRD #U00a733-38).sql" — app memakai tabel
-- custom_field_definitions + kolom jsonb invoices.custom_fields /
-- packing_lists.custom_fields, bukan skema custom_fields/custom_field_values.

-- =============================================
-- GENERIC RLS FOR ALL USER-DATA TABLES
-- =============================================
do $$
declare t text;
begin
  foreach t in array array['companies','customers','suppliers','products',
    'invoices','invoice_items','packing_lists','packing_list_items']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own select" on %I for select using (
      user_id is null and exists(select 1 from invoice_items i join invoices inv on inv.id=i.invoice_id where i.id=id and inv.user_id=auth.uid())
      or user_id = auth.uid()
      or exists(select 1 from profiles p where p.id=auth.uid() and p.role=''developer''))', t);
    execute format('create policy "own insert" on %I for insert with check (
      user_id = auth.uid())', t);
    execute format('create policy "own update" on %I for update using (
      user_id = auth.uid())', t);
    execute format('create policy "own delete" on %I for delete using (
      user_id = auth.uid())', t);
  end loop;
end;
$$;

-- helper: feature check di DB (security boundary)
create function public.has_feature(feature_key text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_features uf
    join features f on f.id = uf.feature_id
    where uf.user_id = auth.uid() and uf.enabled = true
      and f.feature_key = has_feature.feature_key and f.active = true
  );
$$;

create function public.is_account_active()
returns boolean language sql security definer stable as $$
  select coalesce((select status = 'active' from profiles where id = auth.uid()), false);
$$;

-- contoh policy tambahan pada invoices: hanya jika aktif & punya feature
drop policy "own select" on invoices;
create policy "own select" on invoices for select using (
  user_id = auth.uid() or exists(
    select 1 from profiles p where p.id=auth.uid() and p.role='developer'));
drop policy "own insert" on invoices;
create policy "own insert" on invoices for insert with check (
  user_id = auth.uid() and public.is_account_active() and public.has_feature('invoice'));
