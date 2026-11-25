import { Router, Request, Response } from 'express';
import { ICustomerRepo } from '../interfaces/ICustomerRepo.js';
import { customer, preferences } from '../../../shared/src/models/accountsModels.js';
import {
  AuthedRequest, requireCustomerSession, createSession, endSession, endSessionsFor,
  attemptKey, isLocked, recordFailure, clearFailures,
} from '../middleware/customerAuth.js';
import { hashPassword, verifyPassword, isHashed, fakeVerify } from '../services/passwords.js';

class ValidationError extends Error {}

// Passwords are never copied into what is sent to the page.
const safeCustomer = (c: Partial<customer>) => ({
  customerID: c.customerID,
  customerName: c.customerName,
  customerPreferences: {
    allergies: c.customerPreferences?.allergies ?? [],
    foodPreferences: c.customerPreferences?.foodPreferences ?? [],
  },
});

function requireText(value: unknown, name: string, max = 100): string {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError(`${name} is required`);
  if (value.trim().length > max) throw new ValidationError(`${name} must be at most ${max} characters`);
  return value.trim();
}

function requireNewPassword(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length < 6) {
    throw new ValidationError(`${name} must be at least 6 characters`);
  }
  if (value.length > 200) throw new ValidationError(`${name} is too long`);
  return value;
}

// Accepts an array or a comma-separated string; returns a clean list of short strings.
function cleanList(value: unknown, name: string): string[] {
  if (value === undefined || value === null || value === '') return [];
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : null;
  if (!raw) throw new ValidationError(`${name} must be a list`);
  const items = raw.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
  if (items.length > 20) throw new ValidationError(`${name} can have at most 20 entries`);
  if (items.some((i) => i.length > 50)) throw new ValidationError(`Each entry in ${name} must be at most 50 characters`);
  return items;
}

function cleanPreferences(body: any): preferences {
  const source = body?.customerPreferences ?? body ?? {};
  return {
    allergies: cleanList(source.allergies, 'allergies'),
    foodPreferences: cleanList(source.foodPreferences, 'foodPreferences'),
  };
}

export function createCustomerRouter(repo: ICustomerRepo): Router {
  const router = Router();

  const fail = (res: Response, error: unknown) => {
    if (error instanceof ValidationError) return res.status(400).json({ message: error.message });
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  };

  // Re-checks the logged-in customer's password for edit / change password / delete.
  // Returns true if it is correct; otherwise it has already sent the error response.
  async function confirmPassword(req: AuthedRequest, res: Response, supplied: unknown): Promise<boolean> {
    const id = req.customerID!;
    const key = attemptKey(req, id);
    if (isLocked(key)) {
      res.status(429).json({ message: 'Too many wrong attempts. Try again in a few minutes.' });
      return false;
    }
    if (typeof supplied !== 'string' || !supplied) {
      res.status(400).json({ message: 'Your current password is required to make this change.' });
      return false;
    }
    const stored = await repo.FindCustomerPassword(id);
    if (stored === null || !verifyPassword(supplied, stored)) {
      recordFailure(key);
      res.status(403).json({ message: 'Incorrect password.' });
      return false;
    }
    clearFailures(key);
    return true;
  }

  // ---------------- sign up ----------------
  router.post('/Customer/signup', async (req: Request, res: Response) => {
    try {
      const customerID = requireText(req.body?.customerID, 'customerID', 50);
      const customerName = requireText(req.body?.customerName, 'customerName');
      const customerPassword = requireNewPassword(req.body?.customerPassword, 'customerPassword');
      const customerPreferences = cleanPreferences(req.body);

      if ((await repo.FindCustomerPassword(customerID)) !== null) {
        return res.status(409).json({ message: `Customer ID "${customerID}" is already taken. Please choose a different ID.` });
      }
      await repo.AddCustomer({
        customerID, customerName, customerPreferences,
        customerPassword: hashPassword(customerPassword),
      });
      res.status(201).json({ success: true, data: safeCustomer({ customerID, customerName, customerPreferences }) });
    } catch (error) { fail(res, error); }
  });

  // ---------------- log in ----------------
  router.post('/Customer/login', async (req: Request, res: Response) => {
    try {
      const customerID = typeof req.body?.customerID === 'string' ? req.body.customerID.trim() : '';
      const password = typeof req.body?.customerPassword === 'string' ? req.body.customerPassword : '';
      if (!customerID || !password) {
        return res.status(400).json({ message: 'Enter your customer ID and password.' });
      }

      const key = attemptKey(req, customerID);
      if (isLocked(key)) {
        return res.status(429).json({ message: 'Too many wrong attempts. Try again in a few minutes.' });
      }

      const stored = await repo.FindCustomerPassword(customerID);
      let ok = false;
      if (stored === null) fakeVerify(password);
      else ok = verifyPassword(password, stored);

      if (!ok) {
        recordFailure(key);
        // Same message whether the ID or the password was wrong.
        return res.status(401).json({ message: 'Incorrect customer ID or password.' });
      }
      clearFailures(key);

      // Older accounts saved the password as plain text: upgrade to a hash now.
      if (!isHashed(stored!)) await repo.ChangeCustomerPassword(customerID, hashPassword(password));

      const token = createSession(customerID);
      res.status(200).json({ success: true, token, data: safeCustomer(await repo.GetCustomerByID(customerID)) });
    } catch (error) { fail(res, error); }
  });

  // ---------------- everything below needs a logged-in session ----------------
  router.use('/Customer/me', requireCustomerSession);
  router.post('/Customer/logout', requireCustomerSession, (req: AuthedRequest, res: Response) => {
    endSession(req.token!);
    res.status(200).json({ success: true });
  });

  router.get('/Customer/me', async (req: AuthedRequest, res: Response) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data: safeCustomer(await repo.GetCustomerByID(req.customerID!)) });
    } catch (error) { fail(res, error); }
  });

  // Edit name / preferences (the customer ID itself can't be changed).
  router.post('/Customer/me/edit', async (req: AuthedRequest, res: Response) => {
    try {
      const customerName = requireText(req.body?.customerName, 'customerName');
      const customerPreferences = cleanPreferences(req.body);
      if (!(await confirmPassword(req, res, req.body?.password))) return;
      await repo.EditCustomer(req.customerID!, { customerName, customerPreferences });
      res.status(200).json({ success: true, data: safeCustomer(await repo.GetCustomerByID(req.customerID!)) });
    } catch (error) { fail(res, error); }
  });

  router.post('/Customer/me/password', async (req: AuthedRequest, res: Response) => {
    try {
      const newPassword = requireNewPassword(req.body?.newPassword, 'newPassword');
      if (!(await confirmPassword(req, res, req.body?.password))) return;
      await repo.ChangeCustomerPassword(req.customerID!, hashPassword(newPassword));
      endSessionsFor(req.customerID!, req.token); // log out any other devices
      res.status(200).json({ success: true });
    } catch (error) { fail(res, error); }
  });

  // POST rather than DELETE so the password travels in the body on every host/proxy.
  router.post('/Customer/me/delete', async (req: AuthedRequest, res: Response) => {
    try {
      if (!(await confirmPassword(req, res, req.body?.password))) return;
      await repo.RemoveCustomer(req.customerID!);
      endSessionsFor(req.customerID!);
      res.status(200).json({ success: true });
    } catch (error) { fail(res, error); }
  });

  return router;
}
