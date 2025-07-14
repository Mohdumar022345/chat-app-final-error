import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('🗑️ [API] Starting account deletion for user:', user.id);

    // Delete user data from our database first (this will cascade delete messages)
    await prisma.user.delete({
      where: { id: user.id }
    });

    console.log('✅ [API] User data deleted from database');

    // Delete user from Supabase Auth
    const supabase = createServerSupabaseClient();
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('❌ [API] Failed to delete user from Supabase:', deleteError);
      // Don't throw here since we already deleted from our database
      // The user record in Supabase auth might need manual cleanup
    } else {
      console.log('✅ [API] User deleted from Supabase Auth');
    }

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('💥 [API] Account deletion error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete account',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}