import { Router, Request, Response, NextFunction } from 'express';
import { IChefRepo } from '../../../shared/src/interfaces/IChefRepo';
import { INutritionRepository } from '../../../shared/src/interfaces/INutritionRepository';
import { IPreplistRepository } from '../../../shared/src/interfaces/IPrepListRepository';
import {
  NutritionInformation, NotFoundError, UnauthorizedError, ValidationError, parseKind,
} from '../../../shared/src/mainClasses/NutritionInformation';
import type { Actor, ItemKind } from '../../../shared/src/mainClasses/NutritionInformation';
import type { Prep } from '../../../shared/src/models/MSModels';
import { OwnerContact } from '../mainClasses/OwnerContact';
import { OrderProcessing, OrderNotFoundError, OrderValidationError } from '../../../shared/src/mainClasses/OrderProcessing';
import { ChefRequest, issueChefToken, loginThrottle, passwordsMatch, requireChef } from '../middleware/chefAuth';

const text = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError(`${name} is required`);
  return value.trim();
};

const quantity = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ValidationError('itemQuantity must be a number that is 0 or more');
  }
  return value;
};

// Same rule as the service: 0 to 999999.99 with at most 2 decimal places.
const validPrice = (p: unknown): p is number =>
  typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 999999.99 &&
  Math.abs(p * 100 - Math.round(p * 100)) < 1e-6;

const isNotFound = (e: unknown): boolean =>
  /not\s*found/i.test(String((e as { message?: unknown })?.message ?? ''));

export function createChefRouter(
  service: NutritionInformation,
  menuRepo: INutritionRepository & IPreplistRepository,
  chefRepo: IChefRepo,
  orders: OrderProcessing,
): Router {
  const router = Router();

  const fail = (res: Response, error: unknown) => {
    const message = (error as { message?: string })?.message ?? 'Unknown error';
    if (error instanceof ValidationError || error instanceof OrderValidationError) return res.status(400).json({ message });
    if (error instanceof OrderNotFoundError) return res.status(404).json({ message });
    if (error instanceof UnauthorizedError) return res.status(403).json({ message });
    if (error instanceof NotFoundError || isNotFound(error)) return res.status(404).json({ message });
    console.error(error);
    return res.status(500).json({ message: `Internal server error: ${message}` });
  };

  const findChef = async (id: string) => (await chefRepo.GetAllChefs()).find((c) => c.chefID === id);
  const me = (req: Request) => String((req as ChefRequest).chefID);
  const actorOf = (req: Request): Actor => ({ id: me(req), role: 'chef' });
  const getDish = (kind: ItemKind, name: string) =>
    kind === 'meal' ? menuRepo.getMeal(name) : menuRepo.getSide(name);

  // Which meal or side each prep step is attached to, as the menu sees it.
  const prepOwners = async (): Promise<Map<string, string>> => {
    const [meals, sides] = await Promise.all([menuRepo.showAllMeals(), menuRepo.showAllSides()]);
    const owners = new Map<string, string>();
    for (const m of meals) for (const p of m.prepList) owners.set(p.id ?? p.itemName, `meal "${m.name}"`);
    for (const sd of sides) for (const p of sd.prepList) owners.set(p.id ?? p.itemName, `side "${sd.name}"`);
    return owners;
  };
  const withOwner = (preps: Prep[], owners: Map<string, string>) =>
    preps.map((p) => ({ ...p, belongsTo: owners.get(p.id ?? p.itemName) ?? null }));

  // ---------------- login (the only route that needs no token) ----------------
  router.post('/Chef/login', async (req: Request, res: Response) => {
    try {
      const ip = req.ip ?? 'unknown';
      if (loginThrottle.isLocked(ip)) {
        return res.status(429).json({ message: 'Too many wrong attempts. Try again in a few minutes.' });
      }
      const chefID = typeof req.body?.chefID === 'string' ? req.body.chefID.trim() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      let ok = false;
      if (chefID && password && (await findChef(chefID))) {
        ok = passwordsMatch(password, String((await chefRepo.GetChefPassword(chefID)) ?? ''));
      }
      if (!ok) {
        loginThrottle.recordFailure(ip);
        return res.status(401).json({ message: 'Wrong chef ID or password' });
      }
      loginThrottle.clear(ip);
      res.status(200).json({ success: true, data: { token: issueChefToken(chefID) } });
    } catch (error) { fail(res, error); }
  });

  // Everything below needs a valid token, and the chef must still exist
  // (so removing a chef cuts off their access straight away).
  const stillExists = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await findChef(me(req)))) {
        return res.status(401).json({ message: 'This chef account no longer exists.' });
      }
      next();
    } catch (error) { fail(res, error); }
  };
  router.use('/Chef', requireChef, stillExists);

  // ---------------- customer orders ----------------
  // Every order a customer places is passed on here: what was ordered, and the prep tasks to do.
  // (The same prep tasks are also saved to the prep database through IPreplistRepository.)
  router.get('/Chef/Orders', (_req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data: orders.preparing() });
    } catch (error) { fail(res, error); }
  });

  // The chef finishes an order. The customer's page then shows "ready for pickup".
  router.post('/Chef/Orders/:orderNumber/ready', async (req: Request, res: Response) => {
    try {
      const n = Number(req.params.orderNumber);
      if (!Number.isInteger(n) || n < 1) throw new ValidationError('Order number must be a whole number.');
      const chef = await chefRepo.GetChefByID(me(req));
      res.set('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data: await orders.markReady(n, chef.chefName) });
    } catch (error) { fail(res, error); }
  });

  // ---------------- my account (IChefRepo) ----------------
  // Chefs cannot change their own password. They ask the owner, who sets it from the owner page.
  router.get('/Chef/me', async (req: Request, res: Response) => {
    try {
      const chef = await chefRepo.GetChefByID(me(req));
      res.status(200).json({
        success: true,
        data: {
          chefID: chef.chefID,
          chefName: chef.chefName,
          ownerContact: OwnerContact.details(),
        },
      });
    } catch (error) { fail(res, error); }
  });

  // ---------------- menu items (IMenuRepository + INutritionRepository) ----------------
  router.get('/Chef/Menu/:kind', async (req: Request, res: Response) => {
    try {
      const kind = parseKind(String(req.params.kind));
      const dishes = kind === 'meal' ? await menuRepo.showAllMeals() : await menuRepo.showAllSides();
      res.status(200).json({ success: true, data: dishes });
    } catch (error) { fail(res, error); }
  });

  router.get('/Chef/Menu/:kind/:name', async (req: Request, res: Response) => {
    try {
      const kind = parseKind(String(req.params.kind));
      res.status(200).json({ success: true, data: await getDish(kind, String(req.params.name)) });
    } catch (error) { fail(res, error); }
  });

  router.post('/Chef/Menu', async (req: Request, res: Response) => {
    try {
      res.status(201).json({ success: true, data: await service.createItem(actorOf(req), req.body ?? {}) });
    } catch (error) { fail(res, error); }
  });

  // Change price and/or description (updateMeal / updateSide)
  router.put('/Chef/Menu/:kind/:name', async (req: Request, res: Response) => {
    try {
      const kind = parseKind(String(req.params.kind));
      const name = String(req.params.name);
      const changes: { details?: string; price?: number } = {};
      if (req.body?.details !== undefined) {
        if (typeof req.body.details !== 'string') throw new ValidationError('details must be text');
        changes.details = req.body.details.trim();
      }
      if (req.body?.price !== undefined) {
        if (!validPrice(req.body.price)) {
          throw new ValidationError('price must be between 0 and 999999.99, with at most 2 decimal places');
        }
        changes.price = req.body.price;
      }
      if (!Object.keys(changes).length) throw new ValidationError('nothing to update');
      await getDish(kind, name); // 404 if it doesn't exist
      const saved = kind === 'meal' ? await menuRepo.updateMeal(name, changes) : await menuRepo.updateSide(name, changes);
      res.status(200).json({ success: true, data: saved });
    } catch (error) { fail(res, error); }
  });

  // Removes the item; its prep steps go with it.
  router.delete('/Chef/Menu/:kind/:name', async (req: Request, res: Response) => {
    try {
      const kind = parseKind(String(req.params.kind));
      const name = String(req.params.name);
      await getDish(kind, name);
      if (kind === 'meal') await menuRepo.deleteMeal(name); else await menuRepo.deleteSide(name);
      res.status(204).send();
    } catch (error) { fail(res, error); }
  });

  // ---------------- nutrition and allergens (NutritionInformation service) ----------------
  router.get('/Chef/Nutrition/:kind/:name', async (req: Request, res: Response) => {
    try {
      const w = req.query.weight;
      const weight = typeof w === 'string' && w !== '' ? Number(w) : undefined;
      const view = await service.getInformation(parseKind(String(req.params.kind)), String(req.params.name), weight);
      res.status(200).json({ success: true, data: view });
    } catch (error) { fail(res, error); }
  });

  router.post('/Chef/Nutrition/:kind/:name', async (req: Request, res: Response) => {
    try {
      const { facts, allergens } = req.body ?? {};
      const item = await service.addNutrition(
        actorOf(req), parseKind(String(req.params.kind)), String(req.params.name), facts, allergens);
      res.status(201).json({ success: true, data: item });
    } catch (error) { fail(res, error); }
  });

  router.put('/Chef/Nutrition/:kind/:name', async (req: Request, res: Response) => {
    try {
      const { facts, allergens } = req.body ?? {};
      const item = await service.updateNutrition(
        actorOf(req), parseKind(String(req.params.kind)), String(req.params.name), facts ?? {}, allergens);
      res.status(200).json({ success: true, data: item });
    } catch (error) { fail(res, error); }
  });

  router.delete('/Chef/Nutrition/:kind/:name', async (req: Request, res: Response) => {
    try {
      await service.removeNutrition(actorOf(req), parseKind(String(req.params.kind)), String(req.params.name));
      res.status(204).send();
    } catch (error) { fail(res, error); }
  });

  router.put('/Chef/Allergens/:kind/:name', async (req: Request, res: Response) => {
    try {
      const item = await service.setAllergens(
        actorOf(req), parseKind(String(req.params.kind)), String(req.params.name), req.body?.allergens);
      res.status(200).json({ success: true, data: item });
    } catch (error) { fail(res, error); }
  });

  // ---------------- prep list (IPreplistRepository) ----------------
  // Prep steps are found by their name, so a name can only be used once.
  router.get('/Chef/Prep', async (_req: Request, res: Response) => {
    try {
      const [preps, owners] = await Promise.all([menuRepo.showAllPrep(), prepOwners()]);
      res.status(200).json({ success: true, data: withOwner(preps, owners) });
    } catch (error) { fail(res, error); }
  });

  router.get('/Chef/Prep/:name', async (req: Request, res: Response) => {
    try {
      const prep = await menuRepo.getPrep(String(req.params.name));
      res.status(200).json({ success: true, data: withOwner([prep], await prepOwners())[0] });
    } catch (error) { fail(res, error); }
  });

  router.post('/Chef/Prep', async (req: Request, res: Response) => {
    try {
      const kind = parseKind(String(req.body?.kind));
      const dishName = text(req.body?.dishName, 'dishName');
      const prep: Prep = {
        itemName: text(req.body?.itemName, 'itemName'),
        type: text(req.body?.type, 'type'),
        itemQuantity: quantity(req.body?.itemQuantity),
        steps: text(req.body?.steps, 'steps'),
      };
      await getDish(kind, dishName); // 404 if the meal/side doesn't exist
      if ((await menuRepo.showAllPrep()).some((p) => p.itemName === prep.itemName)) {
        return res.status(409).json({ message: `A prep step named "${prep.itemName}" already exists. Please use a different name.` });
      }
      const owner = kind === 'meal' ? { meal: dishName } : { side: dishName };
      const saved = await menuRepo.addPrep(owner, prep);
      res.status(201).json({ success: true, data: { ...saved, belongsTo: `${kind} "${dishName}"` } });
    } catch (error) { fail(res, error); }
  });

  router.put('/Chef/Prep/:name', async (req: Request, res: Response) => {
    try {
      const name = String(req.params.name);
      const changes: Partial<Omit<Prep, 'id'>> = {};
      if (req.body?.itemName !== undefined) changes.itemName = text(req.body.itemName, 'itemName');
      if (req.body?.type !== undefined) changes.type = text(req.body.type, 'type');
      if (req.body?.itemQuantity !== undefined) changes.itemQuantity = quantity(req.body.itemQuantity);
      if (req.body?.steps !== undefined) changes.steps = text(req.body.steps, 'steps');
      if (!Object.keys(changes).length) throw new ValidationError('nothing to update');
      await menuRepo.getPrep(name); // 404 if it doesn't exist
      if (changes.itemName && changes.itemName !== name &&
          (await menuRepo.showAllPrep()).some((p) => p.itemName === changes.itemName)) {
        return res.status(409).json({ message: `A prep step named "${changes.itemName}" already exists.` });
      }
      const saved = await menuRepo.updatePrep(name, changes);
      res.status(200).json({ success: true, data: withOwner([saved], await prepOwners())[0] });
    } catch (error) { fail(res, error); }
  });

  router.delete('/Chef/Prep/:name', async (req: Request, res: Response) => {
    try {
      const name = String(req.params.name);
      await menuRepo.getPrep(name);
      await menuRepo.removePrep(name);
      res.status(204).send();
    } catch (error) { fail(res, error); }
  });

  return router;
}
