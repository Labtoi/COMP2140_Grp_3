import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

// ---------- sessions (in memory; customers log in again after a server restart) ----------
const SESSION_MS = 30 * 60 * 1000;
const sessions = new Map<string, { customerID: string; expires: number }>();

export function createSession(customerID: string): string {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { customerID, expires: Date.now() + SESSION_MS });
  return token;
}

export function endSession(token: string): void {
  sessions.delete(token);
}

// Ends every session for a customer, optionally keeping one (e.g. after a password change).
export function endSessionsFor(customerID: string, keepToken?: string): void {
  for (const [token, s] of sessions) {
    if (s.customerID === customerID && token !== keepToken) sessions.delete(token);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [token, s] of sessions) if (s.expires <= now) sessions.delete(token);
}, 5 * 60 * 1000).unref();

export interface AuthedRequest extends Request {
  customerID?: string;
  token?: string;
}

export function requireCustomerSession(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = String(req.header('authorization') ?? '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const session = token ? sessions.get(token) : undefined;

  if (!session || session.expires <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ message: 'Please log in again.' });
  }

  session.expires = Date.now() + SESSION_MS; // sliding expiry
  req.customerID = session.customerID;
  req.token = token;
  return next();
}

// ---------- wrong-password lockout (per visitor + customer ID) ----------
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; lockedUntil: number }>();

export const attemptKey = (req: Request, customerID: string) => `${req.ip ?? 'unknown'}|${customerID}`;

export function isLocked(key: string): boolean {
  return (failures.get(key)?.lockedUntil ?? 0) > Date.now();
}

export function recordFailure(key: string): void {
  const record = failures.get(key) ?? { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_FAILS) {
    record.count = 0;
    record.lockedUntil = Date.now() + LOCK_MS;
  }
  failures.set(key, record);
}

export function clearFailures(key: string): void {
  failures.delete(key);
}
