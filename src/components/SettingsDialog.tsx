"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
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
import isEqual from "lodash.isequal";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Moon,
  Sun,
  MessageSquare,
  Zap,
  Shield,
  RotateCcw,
  Trash2,
  Settings,
  Activity,
  Code,
  Palette,
  Bell,
} from "lucide-react";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { DiscardConfirmDialog } from "./DiscardConfirmDialog";

export interface SettingsState {
  aiResponseGrouping: "human-like" | "single" | "two-max";
  typingDelayEnabled: boolean;
  inputDisablingEnabled: boolean;
  showMoodIntensity: boolean;
  selectedCustomTheme: "none" | "pink" | "blue" | "coffee" | "wood";
  showToasts: boolean;
  // Developer settings
  showTypingIndicator: boolean;
  showPendingMessages: boolean;
  showProcessingStatus: boolean;
  congratulatedMilestones: number[]; // New: Array of milestone positions already celebrated
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: SettingsState;
  onUpdateSettings: (settings: Partial<SettingsState>) => Promise<boolean>; // Updated prop type
  onResetAIMood: () => void;
  onClearChatHistory: () => void; // will call mutation
  isUpdatingSettings?: boolean;
  isClearing: boolean;
  messageCount: number;
  onOpenDeleteConfirm: (open: boolean) => void;
  isDeleteDialogOpen: boolean;
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
  onResetAIMood,
  onClearChatHistory,
  isUpdatingSettings = false,
  isClearing,
  messageCount,
  isDeleteDialogOpen,
  onOpenDeleteConfirm,
}: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const [localSettings, setLocalSettings] = useState<SettingsState>(settings);
  const [initialSettings, setInitialSettings] =
    useState<SettingsState>(settings);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Update local settings when props change
  useEffect(() => {
    setLocalSettings(settings);
    setInitialSettings(settings); // Set initial state for comparison
  }, [settings]);

  // Function to check for unsaved changes
  const hasSettingsChanges = useCallback(() => {
    return !isEqual(localSettings, initialSettings);
  }, [localSettings, initialSettings]);

  // Apply specific theme for custom theme

  useEffect(() => {
    const theme = localSettings.selectedCustomTheme;

    if (theme === "coffee") {
      setTheme("dark");
    } else if (["pink", "blue", "wood"].includes(theme)) {
      setTheme("light");
    }
  }, [localSettings.selectedCustomTheme]);

  // Function to revert changes and close the dialog
  const handleDiscardAndClose = useCallback(() => {
    setLocalSettings(initialSettings); // Revert local state to initial
    // Revert theme preview
    localStorage.setItem("customTheme", initialSettings.selectedCustomTheme);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "customTheme",
        newValue: initialSettings.selectedCustomTheme,
      })
    );
    setShowDiscardConfirm(false); // Close confirmation dialog
    onOpenChange(false); // Close main dialog
  }, [initialSettings, onOpenChange]);

  // Intercept dialog close attempt
  const handleDialogCloseAttempt = (newOpenState: boolean) => {
    // If trying to close AND an update is in progress, do nothing
    if (!newOpenState && isUpdatingSettings) {
      return;
    }

    if (!newOpenState && hasSettingsChanges()) {
      setShowDiscardConfirm(true); // Show confirmation if trying to close with changes
    } else {
      handleDiscardAndClose(); // Close directly if no changes or opening
    }
  };

  // Apply theme changes instantly for preview
  useEffect(() => {
    localStorage.setItem("customTheme", localSettings.selectedCustomTheme);
    // Dispatch storage event to trigger theme change in layout
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "customTheme",
        newValue: localSettings.selectedCustomTheme,
      })
    );
  }, [localSettings.selectedCustomTheme, settings.selectedCustomTheme]);
  const handleSettingChange = (key: keyof SettingsState, value: any) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    // Made async
    const success = await onUpdateSettings(localSettings); // Await the update
    if (success) {
      onOpenChange(false); // Close dialog on successful save
    }
  };

  const handleResetMood = () => {
    onResetAIMood();
    // Don't show toast here - it's handled in the parent component
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogCloseAttempt}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Chat Settings
            </DialogTitle>
            <DialogDescription>
              Customize your chat experience and AI behavior
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Custom Theme Settings */}
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Custom Themes
              </Label>
              <div className="space-y-3">
                <Label>Theme Selection</Label>
                <RadioGroup
                  value={localSettings.selectedCustomTheme}
                  onValueChange={(
                    value: "none" | "pink" | "blue" | "coffee" | "wood"
                  ) => handleSettingChange("selectedCustomTheme", value)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="theme-none" />
                    <Label htmlFor="theme-none" className="cursor-pointer">
                      None (Use Light/Dark Mode)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pink" id="theme-pink" />
                    <Label
                      htmlFor="theme-pink"
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <div className="w-4 h-4 rounded-full bg-pink-400"></div>
                      Cute Pink
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="blue" id="theme-blue" />
                    <Label
                      htmlFor="theme-blue"
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <div className="w-4 h-4 rounded-full bg-sky-400"></div>
                      Calm Blue
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="coffee" id="theme-coffee" />
                    <Label
                      htmlFor="theme-coffee"
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <div className="w-4 h-4 rounded-full bg-amber-900"></div>
                      Dark Coffee
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="wood" id="theme-wood" />
                    <Label
                      htmlFor="theme-wood"
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <div className="w-4 h-4 rounded-full bg-amber-700"></div>
                      Wooden Brown
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-sm text-muted-foreground">
                  Custom themes override the light/dark mode setting. Changes
                  are previewed instantly and saved when you click &quot;Save
                  Settings&quot;.
                </p>
              </div>
            </div>

            <Separator />

            {/* Theme Settings */}
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                {theme === "dark" ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
                Light/Dark Mode
              </Label>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Toggle between light and dark themes (disabled when custom
                    theme is selected)
                  </p>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) =>
                    setTheme(checked ? "dark" : "light")
                  }
                  disabled={localSettings.selectedCustomTheme !== "none"}
                />
              </div>
            </div>

            <Separator />

            {/* Display Settings */}
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Display Options
              </Label>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Show Mood Intensity Indicator</Label>
                  <p className="text-sm text-muted-foreground">
                    Display the AI mood intensity bar in the header
                  </p>
                </div>
                <Switch
                  checked={localSettings.showMoodIntensity}
                  onCheckedChange={(checked) =>
                    handleSettingChange("showMoodIntensity", checked)
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Developer Settings */}
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Code className="w-4 h-4" />
                Developer Settings
              </Label>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Show Notifications (Toasts)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Display success and error notifications
                  </p>
                </div>
                <Switch
                  checked={localSettings.showToasts}
                  onCheckedChange={(checked) =>
                    handleSettingChange("showToasts", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Show Typing Indicator</Label>
                  <p className="text-sm text-muted-foreground">
                    Display &quot;Typing...&quot; status in header
                  </p>
                </div>
                <Switch
                  checked={localSettings.showTypingIndicator}
                  onCheckedChange={(checked) =>
                    handleSettingChange("showTypingIndicator", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Show Pending Messages</Label>
                  <p className="text-sm text-muted-foreground">
                    Display pending message count in header
                  </p>
                </div>
                <Switch
                  checked={localSettings.showPendingMessages}
                  onCheckedChange={(checked) =>
                    handleSettingChange("showPendingMessages", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Show Processing Status</Label>
                  <p className="text-sm text-muted-foreground">
                    Display processing, saving, and loading indicators
                  </p>
                </div>
                <Switch
                  checked={localSettings.showProcessingStatus}
                  onCheckedChange={(checked) =>
                    handleSettingChange("showProcessingStatus", checked)
                  }
                />
              </div>
            </div>

            <Separator />

            {/* AI Response Settings */}
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                AI Response Style
              </Label>

              <div className="space-y-3">
                <Label>Message Grouping</Label>
                <RadioGroup
                  value={localSettings.aiResponseGrouping}
                  onValueChange={(value: "human-like" | "single" | "two-max") =>
                    handleSettingChange("aiResponseGrouping", value)
                  }
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="human-like" id="human-like" />
                    <Label htmlFor="human-like" className="cursor-pointer">
                      Human-like (Multiple Small Messages)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="two-max" id="two-max" />
                    <Label htmlFor="two-max" className="cursor-pointer">
                      Two Messages Maximum
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="single" id="single" />
                    <Label htmlFor="single" className="cursor-pointer">
                      Single Message
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Typing Animation
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show realistic typing delays for AI responses
                  </p>
                </div>
                <Switch
                  checked={localSettings.typingDelayEnabled}
                  onCheckedChange={(checked) =>
                    handleSettingChange("typingDelayEnabled", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Input Protection
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Disable input while AI is responding to prevent spam
                  </p>
                </div>
                <Switch
                  checked={localSettings.inputDisablingEnabled}
                  onCheckedChange={(checked) =>
                    handleSettingChange("inputDisablingEnabled", checked)
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Actions</Label>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleResetMood}
                  variant="outline"
                  className="justify-start"
                  disabled={isUpdatingSettings}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset AI Mood
                </Button>
                <Button
                  onClick={() => onOpenDeleteConfirm(true)}
                  variant="destructive"
                  className="justify-start"
                  disabled={
                    messageCount === 0 || isClearing || isUpdatingSettings
                  }
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Chat History
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleDiscardAndClose}
              variant="outline"
              disabled={isUpdatingSettings}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSettings}
              disabled={isUpdatingSettings || !hasSettingsChanges()}
            >
              {isUpdatingSettings ? "Saving..." : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
        <DiscardConfirmDialog
          open={showDiscardConfirm}
          onOpenChange={setShowDiscardConfirm}
          onConfirmDiscard={handleDiscardAndClose}
          onCancelDiscard={() => setShowDiscardConfirm(false)}
        />
        <ConfirmDeleteDialog
          open={isDeleteDialogOpen}
          onOpenChange={onOpenDeleteConfirm}
          onConfirm={onClearChatHistory}
          isLoading={isClearing}
          messageCount={messageCount} // or total messages count if needed
        />
      </Dialog>
    </>
  );
}
