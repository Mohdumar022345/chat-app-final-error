import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('🗑️ [API] Starting clear chat history request...');
    
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      console.log('❌ [API] Authentication failed');
      return NextResponse.json(
        { error: 'Authentication required' },
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
    }

    console.log('✅ [API] Authentication successful for user:', user.id);
    console.log('🗑️ [API] Clearing all chat history for user:', user.id);

    // Delete all messages for the authenticated user
    const deleteResult = await prisma.message.deleteMany({
      where: { userId: user.id }
    });
      
    console.log('🗑️ [API] Prisma clear result:', deleteResult);

    const deletedCount = deleteResult.count;
    console.log('✅ [API] Chat history cleared successfully:', {
      deletedCount,
      userId: user.id
    });

    return NextResponse.json(
      {
        success: true,
        message: `Chat history cleared successfully (${deletedCount} messages deleted)`,
        deletedCount: deletedCount
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );

  } catch (error) {
    console.error('💥 [API] Unexpected error clearing chat history:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clear chat history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  }
}