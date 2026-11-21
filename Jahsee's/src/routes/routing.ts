import { Router, Request, Response } from 'express';
import { IAnalysisRepo } from '../interfaces/IAnalysisRepo';

export function createRouter(repo: IAnalysisRepo): Router {
  const router = Router();

  router.get('/Analysis', async (_req: Request, res: Response) => {
    try {
      res.status(200).json({ success: true, data: await repo.GetAllAnalysis() });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  router.get('/Analysis/:id', async (req: Request, res: Response) => {
    try {
      const item = await repo.GetAnalysis(String(req.params.id));
      if (!item) return res.status(404).json({ message: 'Not found' });
      res.status(200).json({ success: true, data: item });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  router.post('/Analysis', async (req: Request, res: Response) => {
    try {
      const created = await repo.AddAnalysis(req.body);
      res.status(201).json({ success: true, data: created });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: (error as Error).message });
    }
  });

  router.delete('/Analysis/:id', async (req: Request, res: Response) => {
    try {
      await repo.RemoveAnalysis(String(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  return router;
}