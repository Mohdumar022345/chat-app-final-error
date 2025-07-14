import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { randomBytes } from 'crypto';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a UUID v4 compatible string
 */
export function generateUUID(): string {
  const bytes = randomBytes(16);
  
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  
  const hex = bytes.toString('hex');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32)
  ].join('-');
}

export function isMilestonePosition(position: number): boolean {
  return (
    position === 1 ||
    position === 5 ||
    (position >= 10 && position % 50 === 0)
  );
}
