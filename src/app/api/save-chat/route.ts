import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface SaveMessageRequest {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

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

    const messageData: SaveMessageRequest = await request.json();

    if (!messageData.text || !messageData.sender) {
      return NextResponse.json(
        { error: 'Missing required fields: text, sender' },
        { status: 400 }
      );
    }

    console.log('🔄 Attempting to save message:', {
      id: messageData.id,
      sender: messageData.sender,
      textLength: messageData.text.length,
      userId: user.id
    });

    // Save message using Prisma
    const savedMessage = await prisma.message.create({
      data: {
        id: messageData.id,
        text: messageData.text,
        sender: messageData.sender,
        userId: user.id
      },
      select: {
        id: true,
        createdAt: true
      }
    });

    console.log('💾 Message saved:', {
      id: savedMessage.id,
      sender: messageData.sender,
      text: messageData.text.substring(0, 50) + (messageData.text.length > 50 ? '...' : ''),
      createdAt: savedMessage.createdAt,
      userId: user.id
    });

    return NextResponse.json({
      success: true,
      message: 'Message saved successfully',
      savedMessage: {
        id: savedMessage.id,
        savedAt: savedMessage.createdAt
      }
    });

  } catch (error) {
    console.error('💥 Unexpected error saving message:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve user's messages
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('📖 Fetching messages for user:', user.id);

    const messages = await prisma.message.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        text: true,
        sender: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log('✅ Messages fetched successfully:', { 
      count: messages.length, 
      userId: user.id 
    });

    // Transform createdAt to match expected format
    const transformedMessages = messages.map(msg => ({
      ...msg,
      created_at: msg.createdAt.toISOString()
    }));

    return NextResponse.json({
      messages: transformedMessages,
      count: messages.length
    });

  } catch (error) {
    console.error('💥 Error fetching messages:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}