import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/user-profile - Fetch user profile
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user data from database
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        username: true,
        settings: true,
        userPosition: true, // New: Select userPosition
        hasSeenConfetti: true // New: Select hasSeenConfetti
      }
    });

    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Extract profile image URL from settings
    const settings = userData.settings as any;
    const profileImageUrl = settings?.customUserAvatarUrl;

    return NextResponse.json({
      profile: {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        profileImageUrl,
        userPosition: userData.userPosition, // New: Return userPosition
        hasSeenConfetti: userData.hasSeenConfetti // New: Return hasSeenConfetti
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/user-profile - Update user profile
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { username, email, profileImageUrl } = await request.json();

    if (!username || !email) {
      return NextResponse.json(
        { error: 'Username and email are required' },
        { status: 400 }
      );
    }

    // Check if username is already taken by another user
    if (username !== user.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          id: { not: user.id }
        }
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 409 }
        );
      }
    }

    // Update email in Supabase if changed
    if (email !== user.email) {
      const supabase = createServerSupabaseClient();
      const { error: emailError } = await supabase.auth.admin.updateUserById(user.id, {
        email
      });

      if (emailError) {
        console.error('Failed to update email in Supabase:', emailError);
        return NextResponse.json(
          { error: 'Failed to update email' },
          { status: 400 }
        );
      }
    }

    // Get current settings
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { settings: true }
    });

    const currentSettings = currentUser?.settings as any || {};

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        username,
        email,
        settings: {
          ...currentSettings,
          customUserAvatarUrl: profileImageUrl
        }
      },
      select: {
        id: true,
        email: true,
        username: true,
        settings: true,
        userPosition: true, // New: Select userPosition
        hasSeenConfetti: true // New: Select hasSeenConfetti
      }
    });

    // Extract profile image URL from settings
    const settings = updatedUser.settings as any;
    const updatedProfileImageUrl = settings?.customUserAvatarUrl;

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        profileImageUrl: updatedProfileImageUrl,
        userPosition: updatedUser.userPosition, // New: Return userPosition
        hasSeenConfetti: updatedUser.hasSeenConfetti // New: Return hasSeenConfetti
      }
    });

  } catch (error) {
    console.error('Update user profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}