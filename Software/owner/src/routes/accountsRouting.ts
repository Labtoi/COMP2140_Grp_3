import { Router, Request, Response } from 'express';
import { IChefRepo } from '../../../shared/src/interfaces/IChefRepo';
import { chef, customer } from '../../../shared/src/models/accountsModels';
import { requireOwnerKey } from '../middleware/ownerAuth';

class AccountValidationError extends Error {}

// Only the fields listed here are sent to the page. Passwords are never copied into
// these, so the lists and single views can't leak them.
const safeChef = (c: chef) => ({
  chefID: c.chefID,
  chefName: c.chefName,
});

const safeCustomer = (c: customer) => ({
  customerID: c.customerID,
  customerName: c.customerName,
  customerPreferences: {
    allergies: c.customerPreferences?.allergies ?? [],
    foodPreferences: c.customerPreferences?.foodPreferences ?? [],
  },
});

function requireText(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AccountValidationError(`${name} is required`);
  }
  return value.trim();
}

function requirePassword(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length < 6) {
    throw new AccountValidationError(`${name} must be at least 6 characters`);
  }
  return value;
}

export function createAccountsRouter(repo: IChefRepo): Router {
  const router = Router();

  // Owner key required for everything here.
  router.use('/Accounts', requireOwnerKey);

  const fail = (res: Response, error: unknown) => {
    if (error instanceof AccountValidationError) {
      return res.status(400).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  };

  // Look an account up by ID without relying on the database's "not found" error text.
  const findChef = async (id: string) => (await repo.GetAllChefs()).find((c) => c.chefID === id);
  const findCustomer = async (id: string) => (await repo.GetAllCustomers()).find((c) => c.customerID === id);

  // ---------------- chefs ----------------
  router.get('/Accounts/chefs', async (_req: Request, res: Response) => {
    try {
      res.status(200).json({ success: true, data: (await repo.GetAllChefs()).map(safeChef) });
    } catch (error) { fail(res, error); }
  });

  router.get('/Accounts/chefs/:id', async (req: Request, res: Response) => {
    try {
      const found = await findChef(String(req.params.id));
      if (!found) return res.status(404).json({ message: 'Chef ID not found.' });
      res.status(200).json({ success: true, data: safeChef(await repo.GetChefByID(found.chefID)) });
    } catch (error) { fail(res, error); }
  });

  router.post('/Accounts/chefs', async (req: Request, res: Response) => {
    try {
      const chefID = requireText(req.body?.chefID, 'chefID');
      const chefName = requireText(req.body?.chefName, 'chefName');
      const chefPassword = requirePassword(req.body?.chefPassword, 'chefPassword');
      if (await findChef(chefID)) {
        return res.status(409).json({ message: `Chef ID "${chefID}" already exists. Please enter a different ID.` });
      }
      await repo.AddChef({ chefID, chefName, chefPassword });
      res.status(201).json({ success: true, data: safeChef({ chefID, chefName, chefPassword }) });
    } catch (error) { fail(res, error); }
  });

  router.delete('/Accounts/chefs/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await findChef(id))) return res.status(404).json({ message: 'Chef ID not found. Nothing removed.' });
      await repo.RemoveChef(id);
      res.status(204).send();
    } catch (error) { fail(res, error); }
  });

  // The one place a password is ever sent back: only when the owner asks for it by name.
  router.get('/Accounts/chefs/:id/password', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await findChef(id))) return res.status(404).json({ message: 'Chef ID not found.' });
      res.set('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data: { password: await repo.GetChefPassword(id) } });
    } catch (error) { fail(res, error); }
  });

  router.post('/Accounts/chefs/:id/password', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const newPassword = requirePassword(req.body?.newPassword, 'newPassword');
      if (!(await findChef(id))) return res.status(404).json({ message: 'Chef ID not found.' });
      await repo.ChangeChefPassword(id, newPassword);
      res.status(200).json({ success: true });
    } catch (error) { fail(res, error); }
  });

  // ---------------- customers ----------------
  router.get('/Accounts/customers', async (_req: Request, res: Response) => {
    try {
      res.status(200).json({ success: true, data: (await repo.GetAllCustomers()).map(safeCustomer) });
    } catch (error) { fail(res, error); }
  });

  router.get('/Accounts/customers/:id', async (req: Request, res: Response) => {
    try {
      const found = await findCustomer(String(req.params.id));
      if (!found) return res.status(404).json({ message: 'Customer ID not found.' });
      res.status(200).json({ success: true, data: safeCustomer(await repo.GetCustomerByID(found.customerID)) });
    } catch (error) { fail(res, error); }
  });

  router.delete('/Accounts/customers/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!(await findCustomer(id))) return res.status(404).json({ message: 'Customer ID not found. Nothing removed.' });
      await repo.RemoveCustomer(id);
      res.status(204).send();
    } catch (error) { fail(res, error); }
  });

  return router;
}
