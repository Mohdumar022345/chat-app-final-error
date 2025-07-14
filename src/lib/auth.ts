import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from './prisma';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  userPosition: number | null; // New: Optional user position
  hasSeenConfetti: boolean; // New: Track if user has seen confetti
}

export async function verifyAuth(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Create a Supabase client with the public anon key for user token validation
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('Supabase auth error:', error);
      return null;
    }

    // Get user data from our database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, username: true, userPosition: true, hasSeenConfetti: true } // New: Select userPosition and hasSeenConfetti
    });

    if (!dbUser) {
      console.error('User not found in database:', user.id);
      return null;
    }

    return dbUser;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

// Helper function to get user from session (for client-side)
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    // Use the client-side supabase instance for consistency
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, username: true, userPosition: true, hasSeenConfetti: true } // New: Select userPosition and hasSeenConfetti
    });

    return dbUser;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}