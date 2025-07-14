"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ImageCropper } from "@/components/ImageCropper";
import { useUploadThing } from "@/lib/uploadthing";
import Image from "next/image";
import {
  Bot,
  Heart,
  Zap,
  Brain,
  MessageCircle,
  Sparkles,
  Star,
  Crown,
  Smile,
  Coffee,
  Image as LucideImage,
} from "lucide-react";
import { fileToDataUrl, blobToFile } from "@/lib/image";
import { toast } from "sonner";
import isEqual from "lodash.isequal";
import { DiscardConfirmDialog } from "./DiscardConfirmDialog";

export interface AIProfile {
  name: string;
  avatar: string;
  description: string;
  customBehavior: string;
  relationship: string;
  customAvatarUrl?: string;
}

interface AIProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: AIProfile;
  onUpdateProfile: (settings: Partial<AIProfile>) => Promise<boolean>; // Updated prop type
  isUpdating?: boolean;
  showToasts?: boolean;
}

const AVATAR_OPTIONS = [
  { id: "bot", icon: Bot, label: "Robot" },
  { id: "brain", icon: Brain, label: "Brain" },
  { id: "heart", icon: Heart, label: "Heart" },
  { id: "zap", icon: Zap, label: "Lightning" },
  { id: "sparkles", icon: Sparkles, label: "Sparkles" },
  { id: "star", icon: Star, label: "Star" },
  { id: "crown", icon: Crown, label: "Crown" },
  { id: "smile", icon: Smile, label: "Smile" },
  { id: "coffee", icon: Coffee, label: "Coffee" },
  { id: "message", icon: MessageCircle, label: "Message" },
  { id: "custom", icon: LucideImage, label: "Custom" },
];

export function AIProfileDialog({
  open,
  onOpenChange,
  profile,
  onUpdateProfile,
  isUpdating = false,
  showToasts = false,
}: AIProfileDialogProps) {
  const [localProfile, setLocalProfile] = useState<AIProfile>(profile);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [newlyUploadedAvatarUrl, setNewlyUploadedAvatarUrl] = useState<
    string | undefined
  >(undefined);
  const [initialProfile, setInitialProfile] = useState<AIProfile>(profile); // Store initial state
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false); // State for discard confirmation dialog

  // Initialize UploadThing hook for AI avatar uploads
  const { startUpload, isUploading } = useUploadThing("aiAvatarUploader", {
    headers: () => {
      const token = localStorage.getItem("supabase_token");
      return {
        authorization: `Bearer ${token}`,
      };
    },
    onClientUploadComplete: (res) => {
      console.log("✅ AI Avatar upload completed:", res);
      if (res && res[0]) {
        const uploadedImageUrl = res[0].url;
        console.log("🖼️ Uploaded AI avatar URL:", uploadedImageUrl);

        // Store the uploaded URL for later use when saving
        setNewlyUploadedAvatarUrl(uploadedImageUrl);

        if (showToasts) {
          toast.success("AI avatar uploaded successfully!");
        }
      }
      setIsUploadingImage(false);
    },
    onUploadError: (error) => {
      console.error("❌ AI Avatar upload error:", error);
      if (showToasts) {
        toast.error("Failed to upload AI avatar: " + error.message);
      }
      setIsUploadingImage(false);

      // Revert to previous image on error
      setLocalProfile((prev) => ({
        ...prev,
        avatar: profile.avatar,
        customAvatarUrl: profile.customAvatarUrl,
      }));

      // Reset newly uploaded URL
      setNewlyUploadedAvatarUrl(undefined);
    },
    onUploadBegin: (name) => {
      console.log("🚀 AI Avatar upload started for:", name);
      setIsUploadingImage(true);
    },
  });

  // Update local state when profile prop changes (when data is fetched from database)
  useEffect(() => {
    setLocalProfile(profile);
    setInitialProfile(profile);
    setNewlyUploadedAvatarUrl(undefined); // Clear pending upload on prop change
  }, [profile]);

  // Function to check for unsaved changes
  const hasAIProfileChanges = useCallback(() => {
    const currentProfileState = {
      ...localProfile,
      customAvatarUrl:
        newlyUploadedAvatarUrl !== undefined
          ? newlyUploadedAvatarUrl
          : localProfile.customAvatarUrl,
    };
    return !isEqual(currentProfileState, initialProfile);
  }, [localProfile, initialProfile, newlyUploadedAvatarUrl]);

  // Function to revert changes and close the dialog
  const handleDiscardAndClose = useCallback(() => {
    setLocalProfile(initialProfile); // Revert local state to initial
    setNewlyUploadedAvatarUrl(undefined); // Clear pending uploaded image
    setShowDiscardConfirm(false); // Close confirmation dialog
    onOpenChange(false); // Close main dialog
  }, [initialProfile, onOpenChange]);

  // Intercept dialog close attempt
  const handleDialogCloseAttempt = (newOpenState: boolean) => {
    // If trying to close AND an update is in progress, do nothing
    if (!newOpenState && isUpdating) {
      return;
    }

    if (!newOpenState && hasAIProfileChanges()) {
      setShowDiscardConfirm(true); // Show confirmation if trying to close with changes
    } else {
      handleDiscardAndClose(); // Close directly if no changes or opening
    }
  };

  const handleSave = async () => {
    // Made async
    if (!localProfile.name.trim()) {
      if (showToasts) {
        toast.error("AI name is required");
      }
      return;
    }

    // Combine local profile with newly uploaded avatar URL if available
    const profileToSave = {
      ...localProfile,
      ...(newlyUploadedAvatarUrl && {
        customAvatarUrl: newlyUploadedAvatarUrl,
      }),
    };

    const success = await onUpdateProfile(profileToSave); // Await the update
    if (success) {
      onOpenChange(false); // Close dialog on successful save
    }
  };

  const handleReset = () => {
    const defaultProfile: AIProfile = {
      name: "AI Assistant",
      avatar: "bot",
      description: "Your friendly AI companion",
      customBehavior: "",
      relationship: "",
      customAvatarUrl: undefined,
    };
    setLocalProfile(defaultProfile);
    setNewlyUploadedAvatarUrl(undefined);
    onUpdateProfile(defaultProfile);
    if (showToasts) {
      toast.success("AI profile reset to default");
    }
    onOpenChange(false); // Close dialog after reset and save
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
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    try {
      console.log("🖼️ AI Avatar crop completed, starting upload process...");

      // Convert blob to file for UploadThing
      const croppedFile = blobToFile(
        croppedImageBlob,
        `ai-avatar-${Date.now()}.jpg`
      );

      // Immediately update UI with optimistic data URL for instant feedback
      const reader = new FileReader();
      reader.onload = () => {
        const optimisticDataUrl = reader.result as string;
        setLocalProfile(() => ({
          ...localProfile,
          avatar: "custom",
          customAvatarUrl: optimisticDataUrl,
        }));

        console.log("🎯 Optimistic AI avatar UI update applied");
      };
      reader.readAsDataURL(croppedImageBlob);

      // Close the cropper immediately
      setShowImageCropper(false);

      // Start the background upload
      console.log("📤 Starting AI avatar background upload...");
      await startUpload([croppedFile]);
    } catch (error) {
      console.error("Error in AI avatar crop complete:", error);
      if (showToasts) {
        toast.error("Failed to process AI avatar image");
      }
      setIsUploadingImage(false);

      // Revert to previous image on error
      setLocalProfile((prev) => ({
        ...prev,
        avatar: profile.avatar,
        customAvatarUrl: profile.customAvatarUrl,
      }));

      // Reset newly uploaded URL
      setNewlyUploadedAvatarUrl(undefined);
    }
  };

  const selectedAvatarOption =
    AVATAR_OPTIONS.find((option) => option.id === localProfile.avatar) ||
    AVATAR_OPTIONS[0];

  return (
    <Dialog open={open} onOpenChange={handleDialogCloseAttempt}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              {selectedAvatarOption.id === "custom" &&
              localProfile.customAvatarUrl ? (
                <Image
                  width={32}
                  height={32}
                  src={localProfile.customAvatarUrl}
                  alt="Custom Avatar"
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <selectedAvatarOption.icon className="w-4 h-4 text-primary-foreground" />
              )}
            </div>
            AI Profile Settings
          </DialogTitle>
          <DialogDescription>
            Customize your AI assistant&apos;s name, avatar, description, and
            behavior
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* AI Name */}
          <div className="space-y-2">
            <Label htmlFor="ai-name">AI Name</Label>
            <Input
              id="ai-name"
              value={localProfile.name}
              onChange={(e) =>
                setLocalProfile((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter AI name"
              disabled={isUpdating}
            />
          </div>

          {/* Avatar Selection */}
          <div className="space-y-3">
            <Label>Avatar</Label>
            <RadioGroup
              value={localProfile.avatar}
              onValueChange={(value) =>
                setLocalProfile((prev) => ({ ...prev, avatar: value }))
              }
              className="grid grid-cols-5 gap-3"
              disabled={isUpdating}
            >
              {AVATAR_OPTIONS.map((option) => (
                <div
                  key={option.id}
                  className="flex flex-col items-center space-y-1"
                >
                  <RadioGroupItem
                    value={option.id}
                    id={option.id}
                    className="sr-only"
                  />
                  <Label
                    htmlFor={option.id}
                    className={`w-12 h-12 rounded-full bg-primary flex items-center justify-center cursor-pointer transition-all hover:scale-110 ${
                      localProfile.avatar === option.id
                        ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                        : "hover:ring-2 hover:ring-muted-foreground hover:ring-offset-2 hover:ring-offset-background"
                    }`}
                  >
                    {option.id === "custom" ? (
                      localProfile.customAvatarUrl ? (
                        <Image
                          width={40}
                          height={40}
                          src={localProfile.customAvatarUrl}
                          alt="Custom"
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <option.icon className="w-6 h-6 text-primary-foreground" />
                      )
                    ) : (
                      <option.icon className="w-6 h-6 text-primary-foreground" />
                    )}
                  </Label>
                  <span className="text-xs text-center text-muted-foreground">
                    {option.label}
                  </span>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Custom Avatar URL - only show when custom avatar is selected */}

          {localProfile.avatar === "custom" && (
            <div className="space-y-2">
              <Label>Custom Avatar Image</Label>

              {localProfile.customAvatarUrl && (
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Image
                    src={localProfile.customAvatarUrl}
                    alt="AI Avatar Preview"
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Current Avatar</p>
                    <p className="text-xs text-muted-foreground">
                      Click upload to change
                    </p>
                  </div>
                  {newlyUploadedAvatarUrl && (
                    <div className="text-xs text-green-600 dark:text-green-400">
                      New image ready to save
                    </div>
                  )}
                </div>
              )}

              <div className="border-2 border-dashed border-border rounded-lg p-4">
                <input
                  type="file"
                  id="ai-avatar-upload"
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
                  htmlFor="ai-avatar-upload"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
                >
                  {isUploadingImage || isUploading
                    ? "Uploading..."
                    : "Upload AI Avatar"}
                </Label>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Image (4MB max)
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a custom image for your AI assistant&apos;s avatar. The
                image will be automatically cropped to a square. Click
                &quot;Save Changes&quot; to apply.
              </p>
            </div>
          )}

          {/* Relationship */}
          <div className="space-y-2">
            <Label htmlFor="ai-relationship">Relationship</Label>
            <Input
              id="ai-relationship"
              value={localProfile.relationship}
              onChange={(e) =>
                setLocalProfile((prev) => ({
                  ...prev,
                  relationship: e.target.value,
                }))
              }
              placeholder="e.g., friend, brother, father, assistant"
              disabled={isUpdating}
            />
            <p className="text-xs text-muted-foreground">
              Define your relationship with the AI (optional)
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="ai-description">Description</Label>
            <Textarea
              id="ai-description"
              value={localProfile.description}
              onChange={(e) =>
                setLocalProfile((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Describe your AI assistant"
              className="min-h-[80px]"
              disabled={isUpdating}
            />
          </div>

          {/* Custom Behavior */}
          <div className="space-y-2">
            <Label htmlFor="ai-behavior">Custom Behavior</Label>
            <Textarea
              id="ai-behavior"
              value={localProfile.customBehavior}
              onChange={(e) =>
                setLocalProfile((prev) => ({
                  ...prev,
                  customBehavior: e.target.value,
                }))
              }
              placeholder="e.g., Be more formal, use technical language, call me by name, etc."
              className="min-h-[100px]"
              disabled={isUpdating}
            />
            <p className="text-xs text-muted-foreground">
              Customize how your AI assistant behaves and responds to you
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button onClick={handleReset} variant="outline" disabled={isUpdating}>
            Reset to Default
          </Button>
          <Button
            onClick={handleSave}
            disabled={isUpdating || !localProfile.name.trim() || !hasAIProfileChanges()}
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
          title="Crop AI Avatar"
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
