import { createUploadthing, type FileRouter } from "uploadthing/next";
import { createClient } from '@supabase/supabase-js';

const f = createUploadthing();

// Helper function to verify auth for UploadThing
async function verifyUploadThingAuth(req: Request) {
  try {
    // Create a Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No authorization header');
    }

    const token = authHeader.substring(7);
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      throw new Error('Invalid token');
    }

    return { userId: user.id, email: user.email };
  } catch (error) {
    console.error('UploadThing auth error:', error);
    throw new Error("Unauthorized");
  }
}

export const ourFileRouter = {
  // Profile image uploader - for user profile pictures
  profileImageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      // Verify user authentication with UploadThing compatible method
      const user = await verifyUploadThingAuth(req);

      return { userId: user.userId, email: user.email };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Profile image upload complete for user:", metadata.userId);
      console.log("File URL:", file.url);
      
      // Return data that will be sent to the client
      return { 
        uploadedBy: metadata.userId,
        url: file.url,
        name: file.name,
        size: file.size
      };
    }),

  // AI avatar uploader - for AI profile custom avatars
  aiAvatarUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      // Verify user authentication with UploadThing compatible method
      const user = await verifyUploadThingAuth(req);

      return { userId: user.userId, email: user.email };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("AI avatar upload complete for user:", metadata.userId);
      console.log("File URL:", file.url);
      
      // Return data that will be sent to the client
      return { 
        uploadedBy: metadata.userId,
        url: file.url,
        name: file.name,
        size: file.size
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;