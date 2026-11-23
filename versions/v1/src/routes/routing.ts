import { Router, Request, Response } from 'express';
import { StockAnalysis, ValidationError } from '../mainClasses/StockAnalysis';

export function createRouter(service: StockAnalysis): Router {
  const router = Router();

  const fail = (res: Response, error: unknown) => {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  };

  router.get('/Analysis', async (_req: Request, res: Response) => {
    try {
      res.status(200).json({ success: true, data: await service.getAll() });
    } catch (error) { fail(res, error); }
  });

  router.get('/Analysis/:id', async (req: Request, res: Response) => {
    try {
      const item = await service.getById(String(req.params.id));
      if (!item) return res.status(404).json({ message: 'Not found' });
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
      await service.remove(String(req.params.id));
      res.status(204).send();
    } catch (error) { fail(res, error); }
  });

  return router;
}