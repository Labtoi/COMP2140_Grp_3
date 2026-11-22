-- Run once against your Postgres database (e.g. in the Supabase/Neon SQL editor or psql).
CREATE TABLE IF NOT EXISTS menu_items (
  id                     TEXT PRIMARY KEY,
  kind                   TEXT NOT NULL CHECK (kind IN ('meal', 'side')),
  name                   TEXT NOT NULL,
  details                TEXT NOT NULL DEFAULT '',
  cost_cents             INTEGER NOT NULL CHECK (cost_cents >= 0),
  allergens              TEXT[] NOT NULL DEFAULT '{}',
  -- nutrition is stored per 100 g; all NULL means "no nutritional data stored"
  calories_per_100g      DOUBLE PRECISION CHECK (calories_per_100g >= 0),
  protein_per_100g       DOUBLE PRECISION CHECK (protein_per_100g >= 0),
  carbohydrates_per_100g DOUBLE PRECISION CHECK (carbohydrates_per_100g >= 0),
  fats_per_100g          DOUBLE PRECISION CHECK (fats_per_100g >= 0),
  sodium_mg_per_100g     DOUBLE PRECISION CHECK (sodium_mg_per_100g >= 0),
  vitamins               TEXT,
  default_weight_g       DOUBLE PRECISION CHECK (default_weight_g > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS menu_items_kind_name ON menu_items (kind, lower(name));

-- Sample data (illustrative figures only)
INSERT INTO menu_items VALUES
 ('m1','meal','Jerk Chicken','Quarter chicken, grilled',95000,'{soy}',190,24,3,9,420,'B6, B12, niacin',250),
 ('m2','meal','Curry Goat','Slow-cooked, with gravy',120000,'{}',165,20,4,8,380,'B12, iron',220),
 ('m3','meal','Veggie Patty','Baked pastry, vegetable filling',40000,'{gluten,soy}',NULL,NULL,NULL,NULL,NULL,NULL,NULL),
 ('s1','side','Rice and Peas','Coconut milk, kidney beans',30000,'{coconut}',150,4,26,3.5,190,'B1, folate',150),
 ('s2','side','Fried Plantain','Ripe, pan-fried',25000,'{}',NULL,NULL,NULL,NULL,NULL,NULL,NULL)
ON CONFLICT DO NOTHING;
