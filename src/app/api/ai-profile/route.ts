import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Default AI profile for new users
const DEFAULT_AI_PROFILE = {
  name: 'AI Assistant',
  avatar: 'bot',
  description: 'Your friendly AI companion',
  customBehavior: '',
  relationship: '',
  customAvatarUrl: undefined
};

// POST /api/ai-profile - Update AI profile only
export async function POST(request: NextRequest) {
  console.log('🔍 [POST] Starting AI profile update...');
  
  try {
    // Step 1: Verify authentication
    console.log('🔍 [POST] Step 1: Verifying authentication...');
    const user = await verifyAuth(request);
    if (!user) {
      console.log('❌ [POST] Authentication failed');
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
    console.log('✅ [POST] Authentication successful for user:', user.id);

    // Step 2: Parse request body
    console.log('🔍 [POST] Step 2: Parsing request body...');
    let newAIProfile;
    try {
      const body = await request.text();
      console.log('📝 [POST] Raw request body:', body);
      
      if (!body || body.trim() === '') {
        console.error('❌ [POST] Empty request body');
        return NextResponse.json(
          { error: 'Request body is empty' },
          { 
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          }
        );
      }
      
      newAIProfile = JSON.parse(body);
      console.log('✅ [POST] Request body parsed successfully:', newAIProfile);
    } catch (parseError) {
      console.error('❌ [POST] Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: parseError instanceof Error ? parseError.message : 'Parse error' },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
    }

    // Step 3: Validate AI profile data
    if (!newAIProfile || typeof newAIProfile !== 'object') {
      console.error('❌ [POST] Invalid AI profile object:', newAIProfile);
      return NextResponse.json(
        { error: 'AI profile must be an object' },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
    }

    console.log('💾 [POST] Step 3: Updating AI profile for user:', { 
      userId: user.id, 
      newAIProfile 
    });

    // Step 4: Fetch current settings
    console.log('🔍 [POST] Step 4: Fetching current settings...');
    const currentUserData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { settings: true }
    });

    if (!currentUserData) {
      console.error('❌ [POST] User not found');
      return NextResponse.json(
        { error: 'User not found' },
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
    }

    // Step 5: Merge AI profile with existing settings
    console.log('🔍 [POST] Step 5: Merging AI profile...');
    const currentSettings = currentUserData.settings as any || {};
    const currentAIProfile = currentSettings.aiProfile || DEFAULT_AI_PROFILE;
    
    // Deep merge AI profile
    const mergedAIProfile = { ...currentAIProfile, ...newAIProfile };
    const updatedSettings = { 
      ...currentSettings, 
      aiProfile: mergedAIProfile 
    };
    
    console.log('✅ [POST] AI profile merged:', { 
      currentAIProfile, 
      newAIProfile, 
      mergedAIProfile 
    });

    // Step 6: Update settings in database
    console.log('🔍 [POST] Step 6: Updating settings in database...');
    
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { settings: updatedSettings },
      select: { settings: true }
    });

    console.log('✅ [POST] AI profile updated successfully:', updatedUser);

    // Step 7: Return success response
    console.log('🔍 [POST] Step 7: Preparing success response...');
    
    return NextResponse.json(
      { 
        success: true, 
        settings: updatedUser.settings,
        aiProfile: (updatedUser.settings as any).aiProfile,
        message: 'AI profile updated successfully'
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    );
    
  } catch (error) {
    console.error('💥 [POST] Unexpected error in POST /api/ai-profile:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
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