import { Allergen, Dish, Prep } from '../../src/models';

// Factories (not constants) so tests never share mutable objects.
export const jerkChicken = (): Dish => ({
  name: 'Jerk Chicken', details: 'Quarter chicken, grilled', price: 950,
  calories: 190, carbohydrates: 3, protein: 24, sodium: 420, fats: 9, vitamins: 2,
  allergens: ['soy'], prepList: [],
});
export const curryGoat = (): Dish => ({
  name: 'Curry Goat', details: 'Slow-cooked, with gravy', price: 1200,
  calories: 165, carbohydrates: 4, protein: 20, sodium: 380, fats: 8, vitamins: 1,
  allergens: [], prepList: [],
});
export const riceAndPeas = (): Dish => ({
  name: 'Rice and Peas', details: 'Coconut milk, kidney beans', price: 300,
  calories: 150, carbohydrates: 26, protein: 4, sodium: 190, fats: 3.5, vitamins: 1,
  allergens: ['tree_nuts'], prepList: [],
});
export const friedPlantain = (): Dish => ({
  name: 'Fried Plantain', details: 'Ripe, pan-fried', price: 250,
  calories: 200, carbohydrates: 31, protein: 1, sodium: 5, fats: 9, vitamins: 1,
  allergens: [], prepList: [],
});
export const chopOnions = (): Prep => ({ itemName: 'Onion', type: 'chop', itemQuantity: 3, steps: 'Dice finely' });
export const marinate = (): Prep => ({ itemName: 'Chicken', type: 'marinate', itemQuantity: 10, steps: 'Rub with jerk paste, rest 2 hours' });

export const ALLERGENS: Allergen[] = ['gluten', 'dairy', 'eggs', 'peanuts', 'tree_nuts', 'soy', 'fish', 'shellfish', 'sesame'];
