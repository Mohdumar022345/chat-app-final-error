import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { hasSeenConfetti } = await request.json();

    if (typeof hasSeenConfetti !== 'boolean') {
      return NextResponse.json(
        { error: 'hasSeenConfetti must be a boolean value' },
        { status: 400 }
      );
    }

    console.log('🎊 [API] Updating confetti status for user:', {
      userId: user.id,
      hasSeenConfetti
    });

    // Update the hasSeenConfetti status for the user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { hasSeenConfetti },
      select: {
        id: true,
        hasSeenConfetti: true
      }
    });

    console.log('✅ [API] Confetti status updated successfully:', {
      userId: updatedUser.id,
      hasSeenConfetti: updatedUser.hasSeenConfetti
    });

    return NextResponse.json({
      success: true,
      message: 'Confetti status updated successfully',
      hasSeenConfetti: updatedUser.hasSeenConfetti
    });

  } catch (error) {
    console.error('💥 [API] Error updating confetti status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update confetti status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}