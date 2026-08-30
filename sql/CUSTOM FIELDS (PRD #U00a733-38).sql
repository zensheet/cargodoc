-- ============================================
-- CUSTOM FIELDS (PRD §33-38)
-- ============================================

-- Definisi custom field milik tiap user
create table if not exists custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  field_key text not null,            -- kunci unik, mis. "color"
  field_label text not null,          -- label tampil, mis. "Color"
  applies_to text not null default 'both'
    check (applies_to in ('invoice', 'packing_list', 'both')),
  is_suggested boolean default false, -- PRD §34: suggested fields
  sort_order integer default 0,
  created_at timestamptz default now(),
  unique (user_id, field_key, applies_to)
);

alter table custom_field_definitions enable row level security;
create policy "users manage own field defs" on custom_field_definitions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Nilai custom field per dokumen (JSONB)
alter table invoices
  add column if not exists custom_fields jsonb default '{}'::jsonb;
alter table packing_lists
  add column if not exists custom_fields jsonb default '{}'::jsonb;
