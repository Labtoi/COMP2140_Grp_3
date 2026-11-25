import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';

// Hash both sides so the comparison is constant-time and length-safe.
const digest = (s: string) => createHash('sha256').update(s).digest();

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; lockedUntil: number }>();

export function requireOwnerKey(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.OWNER_KEY;
  if (!secret) {
    console.error('OWNER_KEY is not set in .env');
    return res.status(500).json({ message: 'Server is not configured' });
  }

  const ip = req.ip ?? 'unknown';
  const record = failures.get(ip) ?? { count: 0, lockedUntil: 0 };

  if (record.lockedUntil > Date.now()) {
    return res.status(429).json({ message: 'Too many wrong attempts. Try again in a few minutes.' });
  }

  const supplied = String(req.header('x-owner-key') ?? '');
  if (supplied && timingSafeEqual(digest(supplied), digest(secret))) {
    failures.delete(ip);
    return next();
  }

  record.count += 1;
  if (record.count >= MAX_FAILS) {
    record.count = 0;
    record.lockedUntil = Date.now() + LOCK_MS;
  }
  failures.set(ip, record);
  return res.status(401).json({ message: 'Wrong key' });
}
