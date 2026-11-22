-- Stock table for the restaurant app (Postgres / Supabase)

create table if not exists "DatabaseM" (
  item_id        text primary key,
  item_name      text not null,
  item_quantity  numeric(10, 2) not null default 0 check (item_quantity >= 0),
  date_added     date not null default current_date,
  expiry_date    date,
  type           text,
  check (expiry_date is null or expiry_date >= date_added)
);

create index if not exists databasem_expiry_idx on "DatabaseM" (expiry_date);

alter table "DatabaseM" enable row level security;