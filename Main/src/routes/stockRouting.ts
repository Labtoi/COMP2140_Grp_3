import { Router, Request, Response } from 'express';
import { IStockService } from '../interfaces/IStockService';
import { StockValidationError } from '../mainClasses/StockManagement';

// Turns "2026-12-31" into a local date (avoids the day-off timezone issue)
function parseDate(value: unknown): Date {
  const m = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!m) throw new StockValidationError('expiryDate must be a date in YYYY-MM-DD format');
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function requirePositiveNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !(value > 0)) {
    throw new StockValidationError(`${name} must be a number greater than 0`);
  }
  return value;
}

function requireText(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new StockValidationError(`${name} is required`);
  }
  return value.trim();
}

export function createStockRouter(service: IStockService): Router {
  const router = Router();

  const fail = (res: Response, error: unknown) => {
    if (error instanceof StockValidationError) {
      return res.status(400).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  };

  router.get('/Stock', async (_req: Request, res: Response) => {
    try {
      res.status(200).json({ success: true, data: await service.getAllItems() });
    } catch (error) { fail(res, error); }
  });

  // Must be declared before '/Stock/:id', or "expiring" would be read as an item ID
  router.get('/Stock/expiring', async (req: Request, res: Response) => {
    try {
      const days = Number(req.query.days ?? 7);
      if (!Number.isFinite(days) || days < 0) {
        throw new StockValidationError('days must be a non-negative number');
      }
      res.status(200).json({ success: true, data: await service.expiryPeriod(days) });
    } catch (error) { fail(res, error); }
  });

  router.get('/Stock/:id', async (req: Request, res: Response) => {
    try {
      const item = await service.getItem(String(req.params.id));
      if (!item) return res.status(404).json({ message: 'Not found' });
      res.status(200).json({ success: true, data: item });
    } catch (error) { fail(res, error); }
  });

  router.get('/Stock/:id/available', async (req: Request, res: Response) => {
    try {
      const available = await service.itemAvailabilityForMealPrep(String(req.params.id));
      res.status(200).json({ success: true, data: { available } });
    } catch (error) { fail(res, error); }
  });

  // Creates the item, or adds to it if it already exists
  router.post('/Stock/restock', async (req: Request, res: Response) => {
    try {
      const itemID = requireText(req.body?.itemID, 'itemID');
      const itemName = requireText(req.body?.itemName, 'itemName');
      const quantity = requirePositiveNumber(req.body?.quantity, 'quantity');
      const expiryDate = parseDate(req.body?.expiryDate);
      await service.restockItem(itemID, itemName, quantity, expiryDate);
      res.status(200).json({ success: true, data: await service.getItem(itemID) });
    } catch (error) { fail(res, error); }
  });

  router.post('/Stock/:id/use', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const quantity = requirePositiveNumber(req.body?.quantity, 'quantity');
      if (!(await service.getItem(id))) return res.status(404).json({ message: 'Not found' });
      await service.amountUsed(id, quantity);
      res.status(200).json({ success: true, data: await service.getItem(id) });
    } catch (error) { fail(res, error); }
  });

  router.delete('/Stock/:id', async (req: Request, res: Response) => {
    try {
      await service.removeItem(String(req.params.id));
      res.status(204).send();
    } catch (error) { fail(res, error); }
  });

  return router;
}