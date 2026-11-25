import { describe, expect, it } from 'vitest';
import { PrepList } from '../customer/src/mainClasses/PrepList';
import { Meal } from '../customer/src/models/Meal';
import { MealSide } from '../customer/src/models/MealSide';

describe('PrepList (class diagram): seven public properties and PrepInformation', () => {
  it('has the seven properties, empty to start with', () => {
    const p = new PrepList();
    expect(p).toMatchObject({ itemId: '', itemName: '', type: '', itemQuantity: 0, steps: '', meal: null, side: null });
    expect(Object.keys(p).sort()).toEqual(['itemId', 'itemName', 'itemQuantity', 'meal', 'side', 'steps', 'type']);
  });

  it('has PrepInformation as its only public function', () => {
    expect(Object.getOwnPropertyNames(PrepList.prototype).sort()).toEqual(['PrepInformation', 'constructor']);
  });

  it('holds a meal or a side', () => {
    const meal = new Meal('m', 'Burger', 12.5);
    const side = new MealSide('s', 'Fries', 4);
    expect(new PrepList({ meal }).meal).toBe(meal);
    expect(new PrepList({ meal }).side).toBeNull();
    expect(new PrepList({ side }).side).toBe(side);
    expect(new PrepList({ side }).meal).toBeNull();
  });

  it('PrepInformation takes the details from a Prep and presents them', () => {
    const p = new PrepList({ meal: new Meal('m', 'Classic Burger', 12.5) });
    const text = p.PrepInformation({ id: 'abc', itemName: 'Beef Patty', type: 'protein', itemQuantity: 150, steps: 'Grill 4 minutes per side' });
    expect(p).toMatchObject({ itemId: 'abc', itemName: 'Beef Patty', type: 'protein', itemQuantity: 150, steps: 'Grill 4 minutes per side' });
    expect(text).toBe('150 x Beef Patty (protein) for Classic Burger: Grill 4 minutes per side');
  });

  it('names the side for a side, and copes with missing parts', () => {
    const p = new PrepList({ side: new MealSide('s', 'Fries', 4) });
    expect(p.PrepInformation({ itemName: 'Potatoes', type: '', itemQuantity: 300, steps: '' })).toBe('300 x Potatoes for Fries');
    expect(p.itemId).toBe(''); // a Prep with no id
    expect(new PrepList().PrepInformation({ itemName: 'Salt', type: 'seasoning', itemQuantity: 2, steps: 'Measure' })).toBe('2 x Salt (seasoning): Measure');
  });

  it('keeps the quantity a whole number, rounding up so the kitchen never prepares too little', () => {
    const p = new PrepList();
    p.PrepInformation({ itemName: 'Rice', type: 'grain', itemQuantity: 1.2, steps: '' });
    expect(p.itemQuantity).toBe(2);
    p.PrepInformation({ itemName: 'Rice', type: 'grain', itemQuantity: 3, steps: '' });
    expect(p.itemQuantity).toBe(3);
  });

  it('can be used again for the next Prep', () => {
    const p = new PrepList();
    p.PrepInformation({ id: '1', itemName: 'A', type: 'x', itemQuantity: 1, steps: 'one' });
    p.PrepInformation({ itemName: 'B', type: 'y', itemQuantity: 2, steps: 'two' });
    expect(p).toMatchObject({ itemId: '', itemName: 'B', type: 'y', itemQuantity: 2, steps: 'two' });
  });
});
