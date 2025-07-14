"use client";

import { useState, useEffect, useCallback } from "react";
import { UserProfile } from "@/types/user";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ImageCropper } from "@/components/ImageCropper";
import {
  User,
  Key,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Send,
} from "lucide-react";
import { fileToDataUrl, blobToFile } from "@/lib/image";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useUploadThing } from "@/lib/uploadthing";
import isEqual from "lodash.isequal";
import Image from "next/image";
import { DiscardConfirmDialog } from "./DiscardConfirmDialog";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile;
  onUpdateProfile: (settings: Partial<UserProfile>) => Promise<boolean>; // Updated prop type
  isUpdating?: boolean;
  showToasts?: boolean;
}

export function UserProfileDialog({
  open,
  onOpenChange,
  profile,
  onUpdateProfile,
  isUpdating = false,
  showToasts = false,
}: UserProfileDialogProps) {
  const [localProfile, setLocalProfile] = useState<UserProfile>(profile);
  const [initialProfile, setInitialProfile] = useState<UserProfile>(profile); // Store initial state
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [newlyUploadedProfileImageUrl, setNewlyUploadedProfileImageUrl] =
    useState<string | undefined>(undefined);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false); // State for discard confirmation dialog

  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Email verification state
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);

  // Account deletion state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const router = useRouter();

  // Initialize UploadThing hook for profile image uploads
  const { startUpload, isUploading } = useUploadThing("profileImageUploader", {
    headers: () => {
      const token = localStorage.getItem("supabase_token");
      return {
        authorization: `Bearer ${token}`,
      };
    },
    onClientUploadComplete: (res) => {
      console.log("✅ Upload completed:", res);
      if (res && res[0]) {
        const uploadedImageUrl = res[0].url;
        console.log("🖼️ Uploaded image URL:", uploadedImageUrl);

        // Store the uploaded URL for later use when saving
        setNewlyUploadedProfileImageUrl(uploadedImageUrl);

        if (showToasts) {
          toast.success("Profile image uploaded successfully!");
        }
      }
      setIsUploadingImage(false);
    },
    onUploadError: (error) => {
      console.error("❌ Upload error:", error);
      if (showToasts) {
        toast.error("Failed to upload image: " + error.message);
      }
      setIsUploadingImage(false);

      // Revert to previous image on error
      setLocalProfile((prev) => ({
        ...prev,
        profileImageUrl: profile.profileImageUrl,
      }));

      // Reset newly uploaded URL
      setNewlyUploadedProfileImageUrl(undefined);
    },
    onUploadBegin: (name) => {
      console.log("🚀 Upload started for:", name);
      setIsUploadingImage(true);
    },
  });

  // Update local and initial state when profile prop changes
  useEffect(() => {
    setLocalProfile(profile);
    setInitialProfile(profile);
    setNewlyUploadedProfileImageUrl(undefined); // Clear pending upload on prop change
  }, [profile]);

  // Function to check for unsaved changes in basic profile info
  const hasUserProfileChanges = useCallback(() => {
    // Only compare relevant fields for discard confirmation
    const currentBasicProfile = {
      username: localProfile.username,
      email: localProfile.email,
      profileImageUrl:
        newlyUploadedProfileImageUrl !== undefined
          ? newlyUploadedProfileImageUrl
          : localProfile.profileImageUrl,
    };
    const initialBasicProfile = {
      username: initialProfile.username,
      email: initialProfile.email,
      profileImageUrl: initialProfile.profileImageUrl,
    };
    return !isEqual(currentBasicProfile, initialBasicProfile);
  }, [localProfile, initialProfile, newlyUploadedProfileImageUrl]);

  // Function to revert changes and close the dialog
  const handleDiscardAndClose = useCallback(() => {
    setLocalProfile(initialProfile); // Revert local state to initial
    setNewlyUploadedProfileImageUrl(undefined); // Clear pending uploaded image
    setShowDiscardConfirm(false); // Close confirmation dialog
    onOpenChange(false); // Close main dialog
  }, [initialProfile, onOpenChange]);

  // Intercept dialog close attempt
  const handleDialogCloseAttempt = (newOpenState: boolean) => {
    // If trying to close AND an update is in progress, do nothing
    if (!newOpenState && isUpdating) {
      return;
    }

    if (!newOpenState && hasUserProfileChanges()) {
      setShowDiscardConfirm(true); // Show confirmation if trying to close with changes
    } else {
      handleDiscardAndClose(); // Close directly if no changes or opening
    }
  };

  const handleSave = async () => {
    // Made async
    if (!localProfile.username.trim()) {
      if (showToasts) {
        toast.error("Username is required");
      }
      return;
    }

    if (!localProfile.email.trim()) {
      if (showToasts) {
        toast.error("Email is required");
      }
      return;
    }

    // Combine local profile with newly uploaded image URL if available
    const profileToSave = {
      username: localProfile.username,
      email: localProfile.email,
      profileImageUrl:
        newlyUploadedProfileImageUrl || localProfile.profileImageUrl,
    };

    const success = await onUpdateProfile(profileToSave); // Await the update
    if (success) {
      onOpenChange(false); // Close dialog on successful save
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      setIsUploadingImage(true);
      const dataUrl = await fileToDataUrl(file);
      setSelectedImageSrc(dataUrl);
      setShowImageCropper(true);
    } catch (error) {
      console.error("Error processing image:", error);
      if (showToasts) {
        toast.error("Failed to process image");
      }
      setIsUploadingImage(false);
    }
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    try {
      console.log("🖼️ Crop completed, starting upload process...");

      // Convert blob to file for UploadThing
      const croppedFile = blobToFile(
        croppedImageBlob,
        `profile-${Date.now()}.jpg`
      );

      // Immediately update UI with optimistic data URL for instant feedback
      const reader = new FileReader();
      reader.onload = () => {
        const optimisticDataUrl = reader.result as string;
        setLocalProfile((prev) => ({
          ...prev,
          profileImageUrl: optimisticDataUrl,
        }));

        console.log("🎯 Optimistic UI update applied");
      };
      reader.readAsDataURL(croppedImageBlob);

      // Close the cropper immediately
      setShowImageCropper(false);

      // Start the background upload
      console.log("📤 Starting background upload...");
      await startUpload([croppedFile]);
    } catch (error) {
      console.error("Error in crop complete:", error);
      if (showToasts) {
        toast.error("Failed to process cropped image");
      }
      setIsUploadingImage(false);

      // Revert to previous image on error
      setLocalProfile((prev) => ({
        ...prev,
        profileImageUrl: profile.profileImageUrl,
      }));

      // Reset newly uploaded URL
      setNewlyUploadedProfileImageUrl(undefined);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      if (showToasts) {
        toast.error("All password fields are required");
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      if (showToasts) {
        toast.error("New passwords do not match");
      }
      return;
    }

    if (newPassword.length < 6) {
      if (showToasts) {
        toast.error("New password must be at least 6 characters long");
      }
      return;
    }

    setIsChangingPassword(true);

    try {
      // First verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: localProfile.email,
        password: currentPassword,
      });

      if (verifyError) {
        if (showToasts) {
          toast.error("Current password is incorrect");
        }
        setIsChangingPassword(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        if (showToasts) {
          toast.error("Failed to update password: " + updateError.message);
        }
      } else {
        if (showToasts) {
          toast.success("Password updated successfully");
        }
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordSection(false);
      }
    } catch (error) {
      console.error("Password change error:", error);
      if (showToasts) {
        toast.error("Failed to change password");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleEmailVerification = async () => {
    setIsVerifyingEmail(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: localProfile.email,
      });

      if (error) {
        if (showToasts) {
          toast.error("Failed to send verification email: " + error.message);
        }
      } else {
        setEmailVerificationSent(true);
        if (showToasts) {
          toast.success("Verification email sent successfully");
        }
      }
    } catch (error) {
      console.error("Email verification error:", error);
      if (showToasts) {
        toast.error("Failed to send verification email");
      }
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      if (showToasts) {
        toast.error('Please type "DELETE" to confirm account deletion');
      }
      return;
    }

    setIsDeletingAccount(true);

    try {
      // Call our API to delete the account
      const token = localStorage.getItem("supabase_token");
      const response = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete account");
      }

      // Sign out and redirect
      await supabase.auth.signOut();
      localStorage.removeItem("supabase_token");
      if (showToasts) {
        toast.success("Account deleted successfully");
      }
      router.push("/signup");
    } catch (error) {
      console.error("Account deletion error:", error);
      if (showToasts) {
        toast.error(
          "Failed to delete account: " +
            (error instanceof Error ? error.message : "Unknown error")
        );
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogCloseAttempt}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              {localProfile.profileImageUrl ? (
                <Image
                  src={localProfile.profileImageUrl}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-primary-foreground" />
              )}
            </div>
            User Profile Settings
          </DialogTitle>
          <DialogDescription>
            Manage your profile information, security settings, and account
            preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Image Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Profile Picture
            </Label>

            {localProfile.profileImageUrl && (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Image
                  src={localProfile.profileImageUrl}
                  alt="Profile Preview"
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Current Profile Picture</p>
                  <p className="text-xs text-muted-foreground">
                    {isUploadingImage
                      ? "Uploading new image..."
                      : "Click upload to change"}
                  </p>
                </div>
                {isUploadingImage && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    Uploading...
                  </div>
                )}
              </div>
            )}

            <div className="border-2 border-dashed border-border rounded-lg p-4">
              <input
                type="file"
                id="profile-image-upload"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(file);
                  }
                }}
                className="hidden"
                disabled={isUploadingImage}
              />
              <Label
                htmlFor="profile-image-upload"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
              >
                {isUploadingImage || isUploading
                  ? "Processing..."
                  : "Upload Profile Picture"}
              </Label>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Image (4MB max) - Click &quot;Save Changes&quot; to apply
              </p>
            </div>
          </div>

          <Separator />

          {/* Basic Information */}
          <div className="space-y-4">
            <Label className="text-base font-semibold flex items-center gap-2">
              <User className="w-4 h-4" />
              Basic Information
            </Label>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={localProfile.username}
                onChange={(e) =>
                  setLocalProfile((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
                placeholder="Enter username"
                disabled={isUpdating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  value={localProfile.email}
                  onChange={(e) =>
                    setLocalProfile((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  placeholder="Enter email address"
                  disabled={isUpdating}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEmailVerification}
                  disabled={isVerifyingEmail || emailVerificationSent}
                  className="shrink-0"
                >
                  {isVerifyingEmail ? (
                    "Sending..."
                  ) : emailVerificationSent ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Sent
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1" />
                      Verify
                    </>
                  )}
                  {newlyUploadedProfileImageUrl && (
                    <div className="text-xs text-green-600 dark:text-green-400">
                      New image ready to save
                    </div>
                  )}
                </Button>
              </div>
              {emailVerificationSent && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Verification email sent! Check your inbox.
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Password Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Key className="w-4 h-4" />
                Password & Security
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPasswordSection(!showPasswordSection)}
              >
                {showPasswordSection ? "Cancel" : "Change Password"}
              </Button>
            </div>

            {showPasswordSection && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showPasswords.current ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      disabled={isChangingPassword}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() =>
                        setShowPasswords((prev) => ({
                          ...prev,
                          current: !prev.current,
                        }))
                      }
                    >
                      {showPasswords.current ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPasswords.new ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      disabled={isChangingPassword}
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() =>
                        setShowPasswords((prev) => ({
                          ...prev,
                          new: !prev.new,
                        }))
                      }
                    >
                      {showPasswords.new ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showPasswords.confirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      disabled={isChangingPassword}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() =>
                        setShowPasswords((prev) => ({
                          ...prev,
                          confirm: !prev.confirm,
                        }))
                      }
                    >
                      {showPasswords.confirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handlePasswordChange}
                  disabled={
                    isChangingPassword ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                  className="w-full"
                >
                  {isChangingPassword
                    ? "Changing Password..."
                    : "Change Password"}
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Danger Zone */}
          <div className="space-y-4">
            <Label className="text-base font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </Label>

            {!showDeleteConfirmation ? (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirmation(true)}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            ) : (
              <div className="space-y-4 p-4 border border-destructive rounded-lg bg-destructive/10">
                <div className="space-y-2">
                  <Label className="text-destructive font-medium">
                    This action cannot be undone. This will permanently delete
                    your account and all associated data.
                  </Label>
                  <Label htmlFor="delete-confirm">
                    Type &quot;DELETE&quot; to confirm:
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    disabled={isDeletingAccount}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteConfirmation(false);
                      setDeleteConfirmText("");
                    }}
                    disabled={isDeletingAccount}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={
                      isDeletingAccount || deleteConfirmText !== "DELETE"
                    }
                    className="flex-1"
                  >
                    {isDeletingAccount ? "Deleting..." : "Delete Account"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              isUpdating ||
              !localProfile.username.trim() ||
              !localProfile.email.trim() ||
              !hasUserProfileChanges()
            }
          >
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>

        {/* Image Cropper Dialog */}
        <ImageCropper
          open={showImageCropper}
          onOpenChange={setShowImageCropper}
          imageSrc={selectedImageSrc}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          cropShape="round"
          title="Crop Profile Picture"
        />

        {/* Discard Confirmation Dialog */}
        <DiscardConfirmDialog
          open={showDiscardConfirm}
          onOpenChange={setShowDiscardConfirm}
          onConfirmDiscard={handleDiscardAndClose}
          onCancelDiscard={() => setShowDiscardConfirm(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
