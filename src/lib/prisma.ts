import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Database types for TypeScript
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  settings: any;
  userPosition?: number; // New: Optional user position
  hasSeenConfetti?: boolean; // New: Track if user has seen confetti
  createdAt: Date;
  updatedAt: Date;
  feedback: Feedback[]; // New: User's feedback entries
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  userId: string;
  createdAt: Date;
}

// Feedback type
export interface Feedback {
  id: string;
  userId: string;
  userPosition: string;
  feedbackText: string;
  createdAt: Date;
}

// New: AppMetadata type
export interface AppMetadata {
  id: string;
  nextUserPosition: number;
  lastUpdated: Date;
}