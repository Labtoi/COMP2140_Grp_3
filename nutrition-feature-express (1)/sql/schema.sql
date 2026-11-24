-- What was actually ran on supabase

-- SqlDatabaseMeals
create table if not exists sql_database_meals (
  name          text primary key,
  details       text    not null default '',
  price         numeric(8,2) not null check (price >= 0),
  calories      numeric not null default 0,
  carbohydrates numeric not null default 0,
  protein       numeric not null default 0,
  sodium        numeric not null default 0,
  fats          numeric not null default 0,
  vitamins      numeric not null default 0,
  allergens     text[]  not null default '{}'
);
 
-- SqlDatabaseSides (same shape as meals)
create table if not exists sql_database_sides (
  name          text primary key,
  details       text    not null default '',
  price         numeric(8,2) not null check (price >= 0),
  calories      numeric not null default 0,
  carbohydrates numeric not null default 0,
  protein       numeric not null default 0,
  sodium        numeric not null default 0,
  fats          numeric not null default 0,
  vitamins      numeric not null default 0,
  allergens     text[]  not null default '{}'
);
 
-- prepList: Prep[*] on both tables is modelled as a child table.
-- Each prep row belongs to exactly one meal OR one side.
create table if not exists prep (
  id            uuid primary key default gen_random_uuid(),
  item_name     text    not null,
  type          text    not null default '',
  item_quantity numeric not null default 0,
  steps         text    not null default '',
  meal_name     text references sql_database_meals(name) on delete cascade on update cascade,
  side_name     text references sql_database_sides(name) on delete cascade on update cascade,
  check (num_nonnulls(meal_name, side_name) = 1)
);
 
create index if not exists prep_meal_idx on prep(meal_name);
create index if not exists prep_side_idx on prep(side_name);
 
-- Lock the tables down; add policies for whichever roles should have access.
alter table sql_database_meals enable row level security;
alter table sql_database_sides enable row level security;
alter table prep               enable row level security;
