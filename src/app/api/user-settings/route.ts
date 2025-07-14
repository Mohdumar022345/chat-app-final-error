import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Default settings for new users
const DEFAULT_SETTINGS = {
  aiResponseGrouping: 'human-like',
  typingDelayEnabled: true,
  inputDisablingEnabled: true,
  showMoodIntensity: true,
  selectedCustomTheme: 'none',
  showToasts: false,
  // Developer settings
  showTypingIndicator: true,
  showPendingMessages: true,
  showProcessingStatus: true,
  congratulatedMilestones: [] as number[], // New: Default empty array
};

// Default AI profile for new users
const DEFAULT_AI_PROFILE = {
  name: 'AI Assistant',
  avatar: 'bot',
  description: 'Your friendly AI companion',
  customBehavior: '',
  relationship: '',
  customAvatarUrl: undefined
};

// GET /api/user-settings - Fetch user settings
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [GET] Starting user settings fetch...');
    
    const user = await verifyAuth(request);
    if (!user) {
      console.log('❌ [GET] Authentication failed');
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

    console.log('📖 [GET] Fetching settings for user:', user.id);

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { settings: true }
    });

    if (!userData) {
      console.error('❌ [GET] User not found');
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

    // Merge with defaults to ensure all settings exist
    const userSettings = { 
      ...DEFAULT_SETTINGS, 
      ...(userData.settings as any || {}),
      aiProfile: {
        ...DEFAULT_AI_PROFILE,
        ...((userData.settings as any)?.aiProfile || {})
      },
      congratulatedMilestones: ((userData.settings as any)?.congratulatedMilestones || []) as number[], // Ensure it's an array
    };

    console.log('✅ [GET] Settings fetched successfully:', { 
      userId: user.id, 
      settings: userSettings 
    });

    return NextResponse.json(
      { settings: userSettings },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  } catch (error) {
    console.error('💥 [GET] Error in GET /api/user-settings:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
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

// POST /api/user-settings - Update user settings
export async function POST(request: NextRequest) {
  console.log('🔍 [POST] Starting user settings update...');
  
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

    // Step 2: Parse request body with better error handling
    console.log('🔍 [POST] Step 2: Parsing request body...');
    let newSettings;
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
      
      newSettings = JSON.parse(body);
      console.log('✅ [POST] Request body parsed successfully:', newSettings);
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

    // Step 3: Validate settings
    if (!newSettings || typeof newSettings !== 'object') {
      console.error('❌ [POST] Invalid settings object:', newSettings);
      return NextResponse.json(
        { error: 'Settings must be an object' },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
    }

    console.log('💾 [POST] Step 3: Updating settings for user:', { 
      userId: user.id, 
      newSettings 
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

    // Step 5: Merge settings
    console.log('🔍 [POST] Step 5: Merging settings...');
    const currentSettings = { ...DEFAULT_SETTINGS, ...(currentUserData.settings as any || {}) };
    const currentAIProfile = (currentUserData.settings as any)?.aiProfile || DEFAULT_AI_PROFILE;
    
    // Merge general settings while preserving AI profile
    // Note: AI profile updates should use /api/ai-profile endpoint
    const mergedSettings = { 
      ...currentSettings, 
      ...newSettings,
      aiProfile: currentAIProfile, // Always preserve existing AI profile
      congratulatedMilestones: (newSettings.congratulatedMilestones || currentSettings.congratulatedMilestones || []) as number[], // Merge or initialize
    };
    
    console.log('✅ [POST] Settings merged:', { currentSettings, newSettings, mergedSettings });

    // Step 6: Update settings in database
    console.log('🔍 [POST] Step 6: Updating settings in database...');
    
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { settings: mergedSettings },
      select: { settings: true }
    });

    console.log('✅ [POST] Settings updated successfully for user:', user.id);

    // Step 7: Return success response with proper headers
    console.log('🔍 [POST] Step 7: Preparing success response...');
    
    return NextResponse.json(
      { 
        success: true, 
        settings: updatedUser.settings,
        message: 'Settings updated successfully'
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
    console.error('💥 [POST] Unexpected error in POST /api/user-settings:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Ensure we always return a proper JSON response
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