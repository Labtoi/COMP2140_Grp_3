import { Router, Request, Response } from 'express';
import {
  NutritionInformation, NotFoundError, UnauthorizedError, ValidationError, parseKind,
} from '../mainClasses/NutritionInformation';
import type { Actor } from '../mainClasses/NutritionInformation';
import { requireOwnerKey } from '../middleware/ownerAuth';

// Once requireOwnerKey has passed, the caller has proven they hold the owner key,
// so the service is told they are the owner. The service still runs its own
// canEdit check as a second line of defence.
const ownerActor: Actor = { id: 'owner', role: 'owner' };

export function createNutritionRouter(service: NutritionInformation): Router {
  const router = Router();

  const fail = (res: Response, error: unknown) => {
    if (error instanceof ValidationError) {
      res.status(400).json({ message: error.message });
    } else if (error instanceof UnauthorizedError) {
      res.status(403).json({ message: error.message });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({ message: error.message });
    } else {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  // ---------------- public (customers can read) ----------------

  // List meals or sides (kind = "meal" | "side")
  router.get('/Menu/:kind', async (req: Request, res: Response) => {
    try {
      res.status(200).json({ success: true, data: await service.getAll(parseKind(String(req.params.kind))) });
    } catch (error) { fail(res, error); }
  });

  // Nutrition label for one item, optionally scaled: /Nutrition/meal/Jerk%20Chicken?weight=250
  router.get('/Nutrition/:kind/:name', async (req: Request, res: Response) => {
    try {
      const w = req.query.weight;
      const weight = typeof w === 'string' && w !== '' ? Number(w) : undefined;
      const view = await service.getInformation(parseKind(String(req.params.kind)), String(req.params.name), weight);
      res.status(200).json({ success: true, data: view });
    } catch (error) { fail(res, error); }
  });

  // ---------------- owner key required (anything that changes data) ----------------

  // Create a menu item
  router.post('/Menu', requireOwnerKey, async (req: Request, res: Response) => {
    try {
      res.status(201).json({ success: true, data: await service.createItem(ownerActor, req.body ?? {}) });
    } catch (error) { fail(res, error); }
  });

  router.post('/Nutrition/:kind/:name', requireOwnerKey, async (req: Request, res: Response) => {
    try {
      const { facts, allergens } = req.body ?? {};
      const item = await service.addNutrition(ownerActor, parseKind(String(req.params.kind)), String(req.params.name), facts, allergens);
      res.status(201).json({ success: true, data: item });
    } catch (error) { fail(res, error); }
  });

  router.put('/Nutrition/:kind/:name', requireOwnerKey, async (req: Request, res: Response) => {
    try {
      const { facts, allergens } = req.body ?? {};
      const item = await service.updateNutrition(ownerActor, parseKind(String(req.params.kind)), String(req.params.name), facts, allergens);
      res.status(200).json({ success: true, data: item });
    } catch (error) { fail(res, error); }
  });

  router.delete('/Nutrition/:kind/:name', requireOwnerKey, async (req: Request, res: Response) => {
    try {
      await service.removeNutrition(ownerActor, parseKind(String(req.params.kind)), String(req.params.name));
      res.status(204).send();
    } catch (error) { fail(res, error); }
  });

  return router;
}
