import { Router, Request, Response } from 'express';
import {
  NutritionInformation, NotFoundError, UnauthorizedError, ValidationError, parseKind,
} from '../../../shared/src/mainClasses/NutritionInformation';
import type { Actor } from '../../../shared/src/mainClasses/NutritionInformation';

function getActor(req: Request): Actor {
  const role = req.header('x-role');
  return role === 'chef' || role === 'owner' ? { id: role, role } : { id: 'guest', role: 'customer' };
}

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

  // List meals or sides (kind = "meal" | "side")
  router.get('/Menu/:kind', async (req: Request, res: Response) => {
    try {
      res.status(200).json({ success: true, data: await service.getAll(parseKind(String(req.params.kind))) });
    } catch (error) { fail(res, error); }
  });

  // Create a menu item (chef or owner only)
  router.post('/Menu', async (req: Request, res: Response) => {
    try {
      res.status(201).json({ success: true, data: await service.createItem(getActor(req), req.body ?? {}) });
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

  router.post('/Nutrition/:kind/:name', async (req: Request, res: Response) => {
    try {
      const { facts, allergens } = req.body ?? {};
      const item = await service.addNutrition(getActor(req), parseKind(String(req.params.kind)), String(req.params.name), facts, allergens);
      res.status(201).json({ success: true, data: item });
    } catch (error) { fail(res, error); }
  });

  router.put('/Nutrition/:kind/:name', async (req: Request, res: Response) => {
    try {
      const { facts, allergens } = req.body ?? {};
      const item = await service.updateNutrition(getActor(req), parseKind(String(req.params.kind)), String(req.params.name), facts, allergens);
      res.status(200).json({ success: true, data: item });
    } catch (error) { fail(res, error); }
  });

  router.delete('/Nutrition/:kind/:name', async (req: Request, res: Response) => {
    try {
      await service.removeNutrition(getActor(req), parseKind(String(req.params.kind)), String(req.params.name));
      res.status(204).send();
    } catch (error) { fail(res, error); }
  });

  return router;
}
