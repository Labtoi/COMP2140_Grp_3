import { Request, Response, NextFunction } from 'express';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

// Signed login tokens. If CHEF_TOKEN_SECRET is not in .env, a random secret is made each time the
// server starts, which just means chefs log in again after a restart.
const SECRET = process.env.CHEF_TOKEN_SECRET || randomBytes(32).toString('hex');
if (!process.env.CHEF_TOKEN_SECRET) {
  console.warn('CHEF_TOKEN_SECRET is not set: chef logins will reset whenever the server restarts.');
}
const TOKEN_HOURS = 8;

const sign = (data: string) => createHmac('sha256', SECRET).update(data).digest('base64url');
const digest = (s: string) => createHash('sha256').update(s).digest();

export function issueChefToken(chefID: string): string {
  const payload = Buffer.from(
    JSON.stringify({ id: chefID, exp: Date.now() + TOKEN_HOURS * 60 * 60 * 1000 }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readChefToken(token: string): string | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { id, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof id !== 'string' || typeof exp !== 'number' || exp < Date.now()) return null;
    return id;
  } catch {
    return null;
  }
}

export type ChefRequest = Request & { chefID?: string };

// Lets a request through only if it carries a valid chef token, and remembers which chef it is.
export function requireChef(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const chefID = header.startsWith('Bearer ') ? readChefToken(header.slice(7)) : null;
  if (!chefID) return res.status(401).json({ message: 'Please log in again.' });
  (req as ChefRequest).chefID = chefID;
  next();
}

export const passwordsMatch = (supplied: string, stored: string) =>
  timingSafeEqual(digest(supplied), digest(stored));

// Same idea as the owner key: 5 wrong attempts from one address locks it for 15 minutes.
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; lockedUntil: number }>();

export const loginThrottle = {
  isLocked(ip: string): boolean {
    return (failures.get(ip)?.lockedUntil ?? 0) > Date.now();
  },
  recordFailure(ip: string): void {
    const record = failures.get(ip) ?? { count: 0, lockedUntil: 0 };
    record.count += 1;
    if (record.count >= MAX_FAILS) {
      record.count = 0;
      record.lockedUntil = Date.now() + LOCK_MS;
    }
    failures.set(ip, record);
  },
  clear(ip: string): void {
    failures.delete(ip);
  },
};
