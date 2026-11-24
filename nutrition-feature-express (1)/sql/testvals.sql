-- Seed data. Safe to re-run: dishes skip on name clash, prep skips if the same item already exists for that dish.
begin;
 
insert into sql_database_meals (name, details, price, calories, carbohydrates, protein, sodium, fats, vitamins, allergens) values
  ('Classic Burger', 'Beef patty with cheese lettuce and tomato in a brioche bun', 12.50, 700, 45, 35, 900, 40, 5, array['gluten','dairy','sesame']::text[]),
  ('Grilled Chicken Sandwich', 'Marinated chicken breast with garlic mayo', 11.00, 520, 42, 38, 780, 18, 4, array['gluten','eggs']::text[]),
  ('Margherita Pizza', 'Tomato sauce mozzarella and fresh basil', 13.00, 800, 90, 32, 1400, 34, 6, array['gluten','dairy']::text[]),
  ('Salmon Fillet', 'Pan seared salmon with lemon and herbs', 18.50, 480, 5, 42, 420, 30, 12, array['fish']::text[]),
  ('Caesar Salad', 'Romaine lettuce parmesan and croutons with Caesar dressing', 9.50, 350, 14, 12, 640, 28, 8, array['dairy','eggs','fish','gluten']::text[]),
  ('Veggie Stir Fry', 'Seasonal vegetables in a soy and sesame glaze', 10.50, 380, 52, 12, 820, 12, 15, array['soy','sesame','peanuts']::text[]),
  ('Beef Tacos', 'Three soft tacos with spiced beef and cheese', 11.50, 610, 48, 30, 870, 29, 4, array['gluten','dairy']::text[]),
  ('Mushroom Risotto', 'Creamy arborio rice with chestnut mushrooms', 12.00, 560, 74, 14, 900, 22, 7, array['dairy']::text[])
on conflict (name) do nothing;

insert into sql_database_sides (name, details, price, calories, carbohydrates, protein, sodium, fats, vitamins, allergens) values
  ('Fries', 'Skin-on fries with sea salt', 4.00, 320, 42, 4, 300, 15, 2, '{}'::text[]),
  ('Side Salad', 'Mixed leaves with house vinaigrette', 3.50, 90, 8, 2, 120, 6, 10, '{}'::text[]),
  ('Onion Rings', 'Beer battered onion rings', 4.50, 410, 48, 6, 520, 21, 2, array['gluten','eggs','dairy']::text[]),
  ('Coleslaw', 'Creamy cabbage and carrot slaw', 3.00, 180, 12, 2, 210, 14, 6, array['eggs']::text[]),
  ('Garlic Bread', 'Toasted baguette with garlic butter', 3.75, 290, 34, 7, 480, 14, 1, array['gluten','dairy']::text[]),
  ('Steamed Rice', 'Fluffy jasmine rice', 2.50, 210, 46, 4, 10, 0, 0, '{}'::text[])
on conflict (name) do nothing;
 
insert into prep (item_name, type, item_quantity, steps, meal_name)
select v.* from (values
  ('Beef Patty', 'protein', 150, 'Season with salt and pepper, form into a patty, grill 4 minutes per side', 'Classic Burger'),
  ('Brioche Bun', 'bread', 1, 'Slice and toast on the grill', 'Classic Burger'),
  ('Chicken Breast', 'protein', 180, 'Marinate in lemon and herbs, grill until 74C internal', 'Grilled Chicken Sandwich'),
  ('Pizza Dough', 'dough', 250, 'Stretch to a 30cm base, rest 10 minutes', 'Margherita Pizza'),
  ('Mozzarella', 'dairy', 120, 'Slice thinly and spread over the sauce', 'Margherita Pizza'),
  ('Salmon Portion', 'protein', 200, 'Pat dry, season, sear skin side down 4 minutes then flip', 'Salmon Fillet'),
  ('Romaine Lettuce', 'vegetable', 150, 'Wash, chop and chill', 'Caesar Salad'),
  ('Caesar Dressing', 'sauce', 40, 'Whisk and keep chilled', 'Caesar Salad'),
  ('Mixed Vegetables', 'vegetable', 250, 'Slice thinly and stir fry on high heat for 5 minutes', 'Veggie Stir Fry'),
  ('Taco Beef Mince', 'protein', 140, 'Brown with spices, drain excess fat', 'Beef Tacos'),
  ('Arborio Rice', 'grain', 90, 'Toast then add stock gradually, stirring, for 18 minutes', 'Mushroom Risotto'),
  ('Chestnut Mushrooms', 'vegetable', 100, 'Slice and saute until golden', 'Mushroom Risotto')
) as v(item_name, type, item_quantity, steps, meal_name)
where not exists (select 1 from prep p where p.item_name = v.item_name and p.meal_name = v.meal_name);
 
insert into prep (item_name, type, item_quantity, steps, side_name)
select v.* from (values
  ('Potatoes', 'vegetable', 300, 'Cut into batons, soak, then double fry', 'Fries'),
  ('Salad Greens', 'vegetable', 80, 'Wash and dry thoroughly', 'Side Salad'),
  ('Onion', 'vegetable', 150, 'Slice into rings, coat in batter, deep fry', 'Onion Rings'),
  ('Cabbage', 'vegetable', 120, 'Shred and mix with dressing', 'Coleslaw'),
  ('Baguette', 'bread', 1, 'Slice, spread garlic butter, bake 8 minutes', 'Garlic Bread'),
  ('Jasmine Rice', 'grain', 75, 'Rinse and steam for 12 minutes', 'Steamed Rice')
) as v(item_name, type, item_quantity, steps, side_name)
where not exists (select 1 from prep p where p.item_name = v.item_name and p.side_name = v.side_name);
 
commit;