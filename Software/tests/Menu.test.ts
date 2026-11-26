import { describe, expect, it } from 'vitest';
import { Menu, itemKey, matchAllergies } from '../customer/src/mainClasses/Menu';
import { NutritionInformation, NUTRITION_UNAVAILABLE } from '../shared/src/mainClasses/NutritionInformation';
import { Meal } from '../customer/src/models/Meal';
import { MealSide } from '../customer/src/models/MealSide';
import type { Dish } from '../shared/src/models/Dish';
import type { IMenuRepository } from '../shared/src/interfaces/IMenuRepository';
import { InMemoryMsRepository } from './fakes/InMemoryMsRepository';

const dish = (name: string, price: number, over: Partial<Dish> = {}): Dish => ({
  name, details: `${name} details`, price, calories: 200, carbohydrates: 20, protein: 10, sodium: 300, fats: 5, vitamins: 1,
  allergens: [], prepList: [], ...over,
});
const describe_ = (d: Dish) => new NutritionInformation(new InMemoryMsRepository()).mealInformation(d);

describe('Menu (class diagram): two lists and MenuLayout', () => {
  it('has the two lists of what can be ordered, in the Meal and MealSide models', () => {
    const menu = new Menu([new Meal('m1', 'Burger', 12.5)], [new MealSide('s1', 'Fries', 4)]);
    expect(menu.mealOrder).toEqual([new Meal('m1', 'Burger', 12.5)]);
    expect(menu.sideOrder).toEqual([new MealSide('s1', 'Fries', 4)]);
    expect(new Menu().mealOrder).toEqual([]);
    expect(new Menu().sideOrder).toEqual([]);
  });

  it('has MenuLayout as its only public function', () => {
    const methods = Object.getOwnPropertyNames(Menu.prototype).filter((n) => n !== 'constructor' && !n.startsWith('#'));
    // "view" is private in TypeScript (still on the prototype at runtime); everything else public must be MenuLayout
    expect(methods.sort()).toEqual(['MenuLayout', 'view']);
  });

  it('fromDishes uses the Meal and MealSide models, with the name as the id (the database has no ids)', () => {
    const menu = Menu.fromDishes([dish('Burger', 12.5)], [dish('Fries', 4)]);
    expect(menu.mealOrder[0]).toBeInstanceOf(Meal);
    expect(menu.mealOrder[0]).toMatchObject({ mealID: 'Burger', mealName: 'Burger', costM: 12.5 });
    expect(menu.sideOrder[0]).toBeInstanceOf(MealSide);
    expect(menu.sideOrder[0]).toMatchObject({ sideID: 'Fries', sideName: 'Fries', cost: 4 });
  });

  it('load reads through IMenuRepository only', async () => {
    const calls: string[] = [];
    const repo: IMenuRepository = {
      showAllMeals: async () => { calls.push('meals'); return [dish('Burger', 12.5)]; },
      showAllSides: async () => { calls.push('sides'); return [dish('Fries', 4)]; },
      getMeal: async () => { throw new Error('not used'); },
      getSide: async () => { throw new Error('not used'); },
    };
    const menu = await Menu.load(repo, describe_);
    expect(calls.sort()).toEqual(['meals', 'sides']);
    expect(menu.mealOrder).toHaveLength(1);
    expect(menu.sideOrder).toHaveLength(1);
  });

  it('MenuLayout arranges both lists by name with price, details, allergens and nutrition', () => {
    const menu = Menu.fromDishes(
      [dish('Zesty Wrap', 8), dish('Burger', 12.5, { allergens: ['gluten', 'dairy'], calories: 700 })],
      [dish('Fries', 4)],
      describe_,
    );
    const layout = menu.MenuLayout();
    expect(layout.meals.map((m) => m.name)).toEqual(['Burger', 'Zesty Wrap']);
    expect(layout.sides.map((s) => s.name)).toEqual(['Fries']);
    expect(layout.meals[0]).toMatchObject({
      kind: 'meal', id: 'Burger', price: 12.5, details: 'Burger details', allergens: ['gluten', 'dairy'], available: true, allergyWarning: [],
    });
    expect(layout.meals[0].nutrition).toMatchObject({ available: true, calories: 700, allergens: 'gluten, dairy' });
  });

  it('shows "not available" for an item with no nutrition data', () => {
    const menu = Menu.fromDishes([dish('Mystery', 5, { calories: 0, carbohydrates: 0, protein: 0, sodium: 0, fats: 0, vitamins: 0 })], [], describe_);
    expect(menu.MenuLayout().meals[0].nutrition).toMatchObject({ available: false, message: NUTRITION_UNAVAILABLE });
  });

  it('falls back to "not available" for an item it has no details for', () => {
    const layout = new Menu([new Meal('x', 'Loose Item', 3)], []).MenuLayout();
    expect(layout.meals[0]).toMatchObject({ name: 'Loose Item', price: 3, details: '', allergens: [] });
    expect(layout.meals[0].nutrition.available).toBe(false);
  });

  it('marks items that cannot be made, and only the right kind when a meal and a side share a name', () => {
    const menu = Menu.fromDishes([dish('Coleslaw', 6)], [dish('Coleslaw', 3)], describe_);
    const layout = menu.MenuLayout({ unavailable: new Set([itemKey('side', 'Coleslaw')]) });
    expect(layout.meals[0].available).toBe(true);
    expect(layout.sides[0].available).toBe(false);
  });

  it('warns about items that contain one of the customer\'s allergies (SR-2.4)', () => {
    const menu = Menu.fromDishes([dish('Burger', 12.5, { allergens: ['gluten', 'dairy'] }), dish('Salad', 9)], [], describe_);
    const layout = menu.MenuLayout({ customerAllergies: ['Milk'] });
    expect(layout.meals.find((m) => m.name === 'Burger')!.allergyWarning).toEqual(['dairy']);
    expect(layout.meals.find((m) => m.name === 'Salad')!.allergyWarning).toEqual([]);
  });
});

describe('matchAllergies', () => {
  it('matches names exactly, ignoring case, spaces and hyphens', () => {
    expect(matchAllergies(['gluten', 'tree_nuts'], ['Gluten', 'Tree Nuts'])).toEqual(['gluten', 'tree_nuts']);
    expect(matchAllergies(['tree_nuts'], ['tree-nuts'])).toEqual(['tree_nuts']);
  });

  it('understands common words', () => {
    expect(matchAllergies(['dairy'], ['milk'])).toEqual(['dairy']);
    expect(matchAllergies(['gluten'], ['wheat'])).toEqual(['gluten']);
    expect(matchAllergies(['shellfish'], ['shrimp'])).toEqual(['shellfish']);
    expect(matchAllergies(['tree_nuts'], ['almonds'])).toEqual(['tree_nuts']);
  });

  it('is generous on purpose: "nuts" covers tree nuts and peanuts, "egg" covers eggs', () => {
    expect(matchAllergies(['tree_nuts', 'peanuts', 'soy'], ['nuts'])).toEqual(['tree_nuts', 'peanuts']);
    expect(matchAllergies(['eggs'], ['egg'])).toEqual(['eggs']);
    expect(matchAllergies(['shellfish', 'fish'], ['fish'])).toEqual(['shellfish', 'fish']);
  });

  it('does not match everything because of a very short word', () => {
    expect(matchAllergies(['gluten', 'eggs', 'soy'], ['a', 'e', ''])).toEqual([]);
  });

  it('finds nothing for an empty profile or an unrelated one', () => {
    expect(matchAllergies(['gluten'], [])).toEqual([]);
    expect(matchAllergies(['gluten'], ['sesame'])).toEqual([]);
    expect(matchAllergies([], ['gluten'])).toEqual([]);
  });
});
