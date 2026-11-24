import { Router, Request, Response } from 'express';
import { StockAnalysis, ValidationError } from '../mainClasses/StockAnalysis';
import { requireOwnerKey } from '../middleware/ownerAuth';

export function createRouter(service: StockAnalysis): Router {
  const router = Router();

  // Every data route needs the owner key (this includes POST and DELETE).
  router.use(['/Analysis', '/Summary', '/verify'], requireOwnerKey);

  const fail = (res: Response, error: unknown) => {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  };

  // The web page calls this to check the typed key.
  router.get('/verify', (_req: Request, res: Response) => {
    res.status(200).json({ success: true });
  });

  // Totals + popular meals/sides for a date range (menu options 4 and 5).
  router.get('/Summary', async (req: Request, res: Response) => {
    try {
      const range = { start: String(req.query.start ?? ''), end: String(req.query.end ?? '') };
      const [totalMeals, totalSides, revenue, topMeals, leastMeals, topSides, leastSides] = await Promise.all([
        service.totalMealsSold(range),
        service.totalSidesSold(range),
        service.getTotalRevenue(range),
        service.mostPopularMeals(range),
        service.leastPopularMeals(range),
        service.mostPopularSides(range),
        service.leastPopularSides(range),
      ]);
      res.status(200).json({
        success: true,
        data: { totalMeals, totalSides, revenue, topMeals, leastMeals, topSides, leastSides },
      });
    } catch (error) { fail(res, error); }
  });

  router.get('/Analysis', async (_req: Request, res: Response) => {
    try {
      res.status(200).json({ success: true, data: await service.getAll() });
    } catch (error) { fail(res, error); }
  });

  // Add (menu option 1): same as Owner.ts - send id, meals, sides; totals are worked out here.
  router.post('/Analysis/items', async (req: Request, res: Response) => {
    try {
      const { id, meals, sides } = req.body ?? {};
      if (!id || !Array.isArray(meals) || !Array.isArray(sides)) {
        throw new ValidationError('id, meals and sides are required');
      }
      if (await service.idExists(String(id))) {
        return res.status(409).json({ message: `ID "${id}" already exists. Please enter a different ID.` });
      }
      const date = new Date().toLocaleString('sv-SE');
      const saved = await service.addFromItems({ id: String(id), date, meals, sides });
      res.status(201).json({ success: true, data: saved });
    } catch (error) { fail(res, error); }
  });

  router.get('/Analysis/:id', async (req: Request, res: Response) => {
    try {
      const item = await service.getById(String(req.params.id));
      if (!item) return res.status(404).json({ message: 'ID not found. Nothing to show.' });
      res.status(200).json({ success: true, data: item });
    } catch (error) { fail(res, error); }
  });

  router.post('/Analysis', async (req: Request, res: Response) => {
    try {
      res.status(201).json({ success: true, data: await service.add(req.body) });
    } catch (error) { fail(res, error); }
  });

  router.delete('/Analysis/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await service.idExists(id))) {
        return res.status(404).json({ message: 'ID not found. Nothing removed.' });
      }
      await service.remove(id);
      res.status(204).send();
    } catch (error) { fail(res, error); }
  });

  return router;
}
