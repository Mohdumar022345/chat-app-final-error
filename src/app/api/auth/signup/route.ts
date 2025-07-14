import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Parse excluded emails from environment variable
const EXCLUDED_EMAILS = process.env.EXCLUDED_EMAILS
  ? process.env.EXCLUDED_EMAILS.split(",").map((email) =>
      email.trim().toLowerCase()
    )
  : [];

export async function POST(request: NextRequest) {
  try {
    const { email, password, username } = await request.json();

    if (!email || !password || !username) {
      return NextResponse.json(
        { error: "Email, password, and username are required" },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters long" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Check if username already exists in our database
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      );
    }

    // Determine user position
    let newUserPosition: number | null = null;
    const isExcluded = EXCLUDED_EMAILS.includes(email.toLowerCase());

    if (!isExcluded) {
      // Fetch and update the global user position counter
      let appMetadata = await prisma.appMetadata.findFirst();

      if (!appMetadata) {
        // If no metadata exists, create it
        appMetadata = await prisma.appMetadata.create({
          data: { nextUserPosition: 1 },
        });
      }

      newUserPosition = appMetadata.nextUserPosition;

      await prisma.appMetadata.update({
        where: { id: appMetadata.id },
        data: { nextUserPosition: appMetadata.nextUserPosition + 1 },
      });
    }

    // Create user in Supabase Auth
    const supabase = createServerSupabaseClient();
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: {
          username,
          profile_image_url: undefined,
        },
        email_confirm: true, // Auto-confirm email for development
      });

    if (authError || !authData.user) {
      console.error("Supabase signup error:", authError);
      return NextResponse.json(
        { error: authError?.message || "Failed to create account" },
        { status: 400 }
      );
    }

    // Create user in our database with default settings
    const user = await prisma.user.create({
      data: {
        id: authData.user.id,
        email,
        username,
        userPosition: newUserPosition, // New: Assign user position
        settings: {
          aiResponseGrouping: "human-like",
          typingDelayEnabled: true,
          inputDisablingEnabled: true,
          showMoodIntensity: true,
          showTypingIndicator: true,
          showPendingMessages: true,
          showProcessingStatus: true,
          showPoweredByGemini: true,
          customUserAvatarUrl: undefined,
          showToasts: false,
          selectedCustomTheme: "none",
          congratulatedMilestones: [], // New: Initialize empty array
          aiProfile: {
            name: "AI Assistant",
            avatar: "bot",
            relationship: "AI Friend",
            description: "Your friendly AI companion",
            customBehavior: "",
            customAvatarUrl: undefined,
          },
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
        userPosition: true, // New: Select user position
        createdAt: true,
      },
    });

    // Generate session for the user
    const { error: sessionError } = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password,
    });

    if (sessionError) {
      console.error("Session generation error:", sessionError);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        userPosition: user.userPosition, // New: Return user position
      },
      message: "Account created successfully",
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
