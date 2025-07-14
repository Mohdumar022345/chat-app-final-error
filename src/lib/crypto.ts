import { createHash, randomBytes, pbkdf2Sync } from 'crypto';

/**
 * Hash a password using PBKDF2 with a random salt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  } catch (error) {
    return false;
  }
}

/**
 * Generate a secure random string
 */
export function generateSecureRandom(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Create a SHA-256 hash of a string
 */
export function createSHA256Hash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}