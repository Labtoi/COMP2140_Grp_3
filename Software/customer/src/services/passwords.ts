import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';

const PREFIX = 'scrypt$';
const digest = (s: string) => createHash('sha256').update(s).digest();

// New and changed passwords are stored as salted scrypt hashes, never as plain text.
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `${PREFIX}${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function isHashed(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

// Also accepts older accounts whose password was saved as plain text, so existing
// customers can still log in. The caller upgrades those to a hash on success.
export function verifyPassword(password: string, stored: string): boolean {
  if (isHashed(stored)) {
    const [saltHex, hashHex] = stored.slice(PREFIX.length).split('$');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return timingSafeEqual(actual, expected);
  }
  return timingSafeEqual(digest(password), digest(stored));
}

// Burn the same time as a real check when the ID doesn't exist, so response time
// doesn't reveal which IDs are registered.
const DUMMY = hashPassword('dummy-password');
export function fakeVerify(password: string): void {
  verifyPassword(password, DUMMY);
}
