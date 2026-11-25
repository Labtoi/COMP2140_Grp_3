import { Router, Request, Response } from 'express';
import { NutritionInformation } from '../mainClasses/NutritionInformation';
import type { Actor, MenuEntry, NutritionView } from '../mainClasses/NutritionInformation';
import { requireOwnerKey } from '../middleware/ownerAuth';

// The owner key (checked below) is what proves this is the owner. We do NOT use the
// "x-role" header from nutritionRouting.ts, because anyone can type that header themselves.
const OWNER: Actor = { id: 'owner', role: 'owner' };

export function createOwnerMenuRouter(service: NutritionInformation): Router {
  const router = Router();

  router.use('/Owner', requireOwnerKey);

  // Adds price and description to each nutrition row so the owner sees the whole menu.
  const withMenuInfo = (views: NutritionView[], entries: MenuEntry[]) =>
    views.map((v) => {
      const entry = entries.find((e) => e.name === v.name);
      return { ...v, price: entry?.price ?? null, details: entry?.details ?? '' };
    });

  // IOwnerNutritionServiceRepo: showAllMeals + showAllSides (read-only)
  router.get('/Owner/Menu', async (_req: Request, res: Response) => {
    try {
      const [overview, meals, sides] = await Promise.all([
        service.getOwnerOverview(OWNER),
        service.getAll('meal'),
        service.getAll('side'),
      ]);
      res.status(200).json({
        success: true,
        data: {
          meals: withMenuInfo(overview.meals, meals),
          sides: withMenuInfo(overview.sides, sides),
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  return router;
}
