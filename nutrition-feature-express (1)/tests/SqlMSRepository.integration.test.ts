import { describe, it, expect, afterAll } from "vitest";
import { supabase as db } from "../src/config/supabase";
import { SqlMSRepository } from "../src/repositories/SqlMSRepository";
import type { Meal, Side } from "../src/models";

/**
 * Runs against your REAL Supabase project.
 *
 * Safety rules:
 *  - Part 1 is read-only: it just checks your existing rows load and map correctly.
 *  - Part 2 writes only rows whose names start with TEST_PREFIX, and afterAll
 *    deletes only those names. Your own records are never modified or deleted.
 *
 * Uses the shared client from ./config/supabase, which loads SUPABASE_URL and
 * SUPABASE_KEY from .env and throws if they are missing.
 * Use the service_role key (or add RLS policies); with RLS on and no policies,
 * the anon key will see zero rows.
 */

const TEST_PREFIX = `__test_${Date.now()}_`;
const testMeal = (suffix: string, over: Partial<Meal> = {}): Meal => ({
  name: `${TEST_PREFIX}${suffix}`,
  details: "integration test row",
  price: 9.99,
  calories: 100,
  carbohydrates: 10,
  protein: 10,
  sodium: 10,
  fats: 10,
  vitamins: 1,
  allergens: [],
  prepList: [],
  ...over,
});
const testSide = (suffix: string): Side => testMeal(suffix);

describe("SqlMSRepository (real Supabase)", () => {
  const repo = new SqlMSRepository(db);

  /* ---------------- Part 1: read-only, uses YOUR existing rows --------------- */
  describe("existing records (read-only)", () => {
    it("loads all meals and maps them to the domain shape", async () => {
      const meals = await repo.showAllMeals();
      console.log(`Found ${meals.length} meal(s) in SqlDatabaseMeals`);
      for (const m of meals) {
        expect(typeof m.name).toBe("string");
        expect(Number.isFinite(m.price)).toBe(true);
        expect(Array.isArray(m.allergens)).toBe(true);
        expect(Array.isArray(m.prepList)).toBe(true);
      }
    });

    it("loads all sides and maps them to the domain shape", async () => {
      const sides = await repo.showAllSides();
      console.log(`Found ${sides.length} side(s) in SqlDatabaseSides`);
      for (const s of sides) {
        expect(typeof s.name).toBe("string");
        expect(Number.isFinite(s.price)).toBe(true);
      }
    });

    it("getMeal returns the same data as showAllMeals for an existing row", async () => {
      const meals = await repo.showAllMeals();
      if (!meals.length) return; // nothing seeded, nothing to compare
      const first = meals[0];
      expect(await repo.getMeal(first.name)).toEqual(first);
    });

    it("loads all prep rows", async () => {
      const prep = await repo.showAllPrep();
      for (const p of prep) expect(p.itemName).toBeTruthy();
    });
  });

  /* --------- Part 2: writes, but only to rows named with TEST_PREFIX --------- */
  describe("write round-trip (prefixed test rows only)", () => {
    afterAll(async () => {
      // Deletes ONLY rows we created. Prep rows go via ON DELETE CASCADE.
      await db.from("SqlDatabaseMeals").delete().like("name", `${TEST_PREFIX}%`);
      await db.from("SqlDatabaseSides").delete().like("name", `${TEST_PREFIX}%`);
    });

    it("adds, updates and reads back a meal with prep", async () => {
      const dish = testMeal("burger", {
        prepList: [{ itemName: "Test Beef", type: "protein", itemQuantity: 200, steps: "Form patty" }],
      });
      await repo.addMeal(dish);

      const saved = await repo.getMeal(dish.name);
      expect(saved.prepList).toHaveLength(1);

      const updated = await repo.updateMeal(dish.name, { price: 15 });
      expect(updated.price).toBe(15);
    });

    it("adds a side and sees it in showAllSides", async () => {
      const side = testSide("fries");
      await repo.addSide(side);
      const names = (await repo.showAllSides()).map((s) => s.name);
      expect(names).toContain(side.name);
    });

    it("deleting a meal removes it and its prep rows", async () => {
      const dish = testMeal("temp", {
        prepList: [{ itemName: "Temp Item", type: "x", itemQuantity: 1, steps: "y" }],
      });
      await repo.addMeal(dish);
      await repo.deleteMeal(dish.name);

      await expect(repo.getMeal(dish.name)).rejects.toThrow(/not found/);
      const { data } = await db.from("prep").select("id").eq("meal_name", dish.name);
      expect(data).toEqual([]);
    });

    it("rejects a duplicate name (primary key)", async () => {
      const dish = testMeal("dupe");
      await repo.addMeal(dish);
      await expect(repo.addMeal(dish)).rejects.toBeTruthy();
    });
  });
});