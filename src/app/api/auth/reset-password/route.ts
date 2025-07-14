import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token, new_password } = await request.json();

    if (!access_token || !refresh_token || !new_password) {
      return NextResponse.json(
        { error: 'Access token, refresh token, and new password are required' },
        { status: 400 }
      );
    }

    if (new_password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    
    // Set the session using the tokens
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });

    if (sessionError) {
      console.error('Session error:', sessionError);
      return NextResponse.json(
        { error: 'Invalid or expired reset link' },
        { status: 400 }
      );
    }

    // Update the user's password
    const { error: updateError } = await supabase.auth.updateUser({
      password: new_password
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}