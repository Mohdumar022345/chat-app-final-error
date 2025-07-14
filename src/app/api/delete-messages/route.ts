import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { messageIds } = await request.json();

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: 'messageIds must be a non-empty array' }, { status: 400 });
    }

    console.log('🗑️ [Client] Starting delete messages request:', messageIds);

    const deleteResult = await prisma.message.deleteMany({
      where: {
        id: { in: messageIds },
        userId: user.id // Ensure user can only delete their own messages
      }
    });

    console.log('✅ [Client] Delete successful:', deleteResult);

    return NextResponse.json({
      success: true,
      message: `${deleteResult.count} message(s) deleted`,
      deletedCount: deleteResult.count
    });
  } catch (error) {
    console.error('❌ [Client] Failed to delete messages:', error);
    return NextResponse.json(
      { error: 'Server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}