import { Dish } from '../../shared/src/models';
import { FullRepo } from './makeRepo';

export type Changes = Partial<Omit<Dish, 'name' | 'prepList'>>;
export type Kind = 'meal' | 'side';

/** Lets one test body run for both meals and sides. */
export const ops = (r: FullRepo, kind: Kind) =>
  kind === 'meal'
    ? { add: (d: Dish) => r.addMeal(d), get: (n: string) => r.getMeal(n), all: () => r.showAllMeals(),
        update: (n: string, c: Changes) => r.updateMeal(n, c), del: (n: string) => r.deleteMeal(n) }
    : { add: (d: Dish) => r.addSide(d), get: (n: string) => r.getSide(n), all: () => r.showAllSides(),
        update: (n: string, c: Changes) => r.updateSide(n, c), del: (n: string) => r.deleteSide(n) };
