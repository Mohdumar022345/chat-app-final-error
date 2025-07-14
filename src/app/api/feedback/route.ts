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

    const { userPosition, feedbackText } = await request.json();

    if (!userPosition || !feedbackText) {
      return NextResponse.json(
        { error: 'User position and feedback text are required' },
        { status: 400 }
      );
    }

    if (feedbackText.trim().length < 10) {
      return NextResponse.json(
        { error: 'Feedback must be at least 10 characters long' },
        { status: 400 }
      );
    }

    console.log('💬 [API] Creating feedback for user:', {
      userId: user.id,
      userPosition,
      feedbackLength: feedbackText.length
    });

    // Save feedback to database
    const feedback = await prisma.feedback.create({
      data: {
        userId: user.id,
        userPosition,
        feedbackText: feedbackText.trim()
      },
      select: {
        id: true,
        createdAt: true,
        userPosition: true
      }
    });

    console.log('✅ [API] Feedback saved successfully:', {
      feedbackId: feedback.id,
      userId: user.id,
      userPosition: feedback.userPosition
    });

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback: {
        id: feedback.id,
        createdAt: feedback.createdAt,
        userPosition: feedback.userPosition
      }
    });

  } catch (error) {
    console.error('💥 [API] Error saving feedback:', error);
    return NextResponse.json(
      { 
        error: 'Failed to submit feedback',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}