"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ChatInput } from "@/components/chat/ChatInput";
import { SettingsDialog, SettingsState } from "@/components/SettingsDialog";
import { AIProfileDialog, AIProfile } from "@/components/AIProfileDialog";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  Brain,
  Heart,
  Zap,
  LogOut,
  User,
  Settings,
  Trash2,
  X,
  Bot,
  Sparkles,
  Star,
  Crown,
  Smile,
  Coffee,
  Image as LucideImage,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, generateUUID, isMilestonePosition } from "@/lib/utils";
import { UserProfile } from "@/types/user";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { CurrentUser, Message } from "@/types/chat";
import { useAuth } from "@/hooks/use-auth";
import { useSettingsAndProfileUpdates } from "@/hooks/use-settings-and-profile-updates";
import router from "next/router";
import ReactConfetti from "react-confetti";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFeedback } from "@/hooks/use-feedback";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AIState {
  currentMood: string;
  moodIntensity: number;
  lastMoodChange: string;
  recentMessages: Array<{
    text: string;
    timestamp: string;
    sender: string;
  }>;
  conversationContext: {
    userApologized: boolean;
    aiApologized: boolean;
    lastUserMessageTime: string;
  };
}

// Avatar icon mapping
const AVATAR_ICONS = {
  bot: Bot,
  brain: Brain,
  heart: Heart,
  zap: Zap,
  sparkles: Sparkles,
  star: Star,
  crown: Crown,
  smile: Smile,
  coffee: Coffee,
  message: MessageCircle,
  custom: LucideImage,
};

// Helper function to make fetch requests with better error handling
async function safeFetch(url: string, options: RequestInit = {}) {
  console.log(`🌐 [Client] Making request to: ${url}`, options);

  try {
    // Get the stored token
    const token = localStorage.getItem("supabase_token");

    // Increase timeout for AI responses to 2 minutes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ [Client] Request timeout for ${url}`);
      controller.abort();
    }, 120000); // 2 minute timeout for AI responses

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);
    console.log(
      `✅ [Client] Response received from ${url}:`,
      response.status,
      response.statusText
    );

    return response;
  } catch (error) {
    console.error(`❌ [Client] Fetch error for ${url}:`, error);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(
          "Request timeout - the AI is taking longer than usual to respond. Please try again."
        );
      }
      if (error.message.includes("fetch failed")) {
        throw new Error(
          "Network error - please check your connection and try again"
        );
      }
    }

    throw error;
  }
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [aiState, setAIState] = useState<AIState | null>(null);
  const [currentMood, setCurrentMood] = useState<string>("friendly");
  const [pendingMessages, setPendingMessages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingAIResponses, setPendingAIResponses] = useState<
    { messages: { text: string; timestamp: string }[]; aiState: AIState }[]
  >([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(
    new Set()
  );
  const [messagesToDelete, setMessagesToDelete] = useState<string[]>([]);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [congratulatoryMessage, setCongratulatoryMessage] = useState("");
  const [userSettings, setUserSettings] = useState<SettingsState>({
    aiResponseGrouping: "human-like",
    typingDelayEnabled: true,
    inputDisablingEnabled: true,
    showMoodIntensity: true,
    selectedCustomTheme: "none",
    showToasts: false,
    showTypingIndicator: true,
    showPendingMessages: true,
    showProcessingStatus: true,
    congratulatedMilestones: [],
  });
  const [aiProfile, setAiProfile] = useState<AIProfile>({
    name: "AI Assistant",
    avatar: "bot",
    description: "Your friendly AI companion",
    customBehavior: "",
    relationship: "",
    customAvatarUrl: undefined,
  });
  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: "",
    email: "",
    username: "",
    profileImageUrl: undefined,
  });

  const [showSettings, setShowSettings] = useState(false);
  const [showAIProfile, setShowAIProfile] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isLoadingChatHistory, setIsLoadingChatHistory] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { checkAuth, updateHasSeenConfetti, handleLogout } = useAuth({
    setIsAuthenticated,
    setCurrentUser,
    setUserProfile,
    setUserSettings,
    setAiProfile,
    setIsLoadingSettings,
    setIsLoadingChatHistory,
    setMessages,
    userSettings,
  });

  const {
    handleUpdateUserSettings,
    handleUpdateAIProfile,
    handleUpdateUserProfile,
    isUpdatingSettings,
    isUpdatingAIProfile,
    isUpdatingUserProfile,
  } = useSettingsAndProfileUpdates({
    setUserSettings,
    setAiProfile,
    setUserProfile,
    setCurrentUser,
    userSettings,
  });

  useEffect(() => {
    if (!isProcessing && pendingMessages.length > 0) {
      processPendingMessages();
    }
  }, [isProcessing, pendingMessages]);

  useEffect(() => {
    if (!isProcessing && !isTyping && pendingAIResponses.length > 0) {
      processNextAIResponse();
    }
  }, [isProcessing, isTyping, pendingAIResponses]);

  const processPendingMessages = async () => {
    if (pendingMessages.length === 0 || isProcessing) return;

    const messagesToProcess = [...pendingMessages];
    setPendingMessages([]);

    // Use chat mutation for pending messages
    chatMutation.mutate({
      message: messagesToProcess.join("\n"),
      conversationHistory: messages.map((msg) => ({
        text: msg.text,
        sender: msg.sender,
      })),
      aiState: aiState,
      aiResponseGrouping: userSettings.aiResponseGrouping,
      customAIBehavior: aiProfile.customBehavior || "",
      aiName: aiProfile.name,
    });
  };

  // TanStack Query mutation for saving messages
  const saveMessageMutation = useMutation({
    mutationFn: async (message: {
      id: string;
      text: string;
      sender: "user" | "ai";
    }) => {
      const response = await safeFetch("/api/save-chat", {
        method: "POST",
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          throw new Error("Authentication required");
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save message");
      }

      return response.json();
    },
    onError: (error) => {
      console.error("Failed to save message:", error);
      if (userSettings.showToasts) {
        toast.error("Failed to save message");
      }
    },
    onSuccess: (data, variables) => {
      console.log(`✅ Message saved successfully:`, {
        id: variables.id,
        sender: variables.sender,
        savedAt: data.savedMessage?.savedAt,
      });
    },
  });

  // TanStack Query mutation for chat API
  const chatMutation = useMutation({
    mutationFn: async ({
      message,
      conversationHistory,
      aiState,
      aiResponseGrouping,
      customAIBehavior,
      aiName,
    }: {
      message: string;
      conversationHistory: Array<{ text: string; sender: string }>;
      aiState: AIState | null;
      aiResponseGrouping: string;
      customAIBehavior: string;
      aiName: string;
    }) => {
      // Modify the custom behavior to include AI name
      const enhancedBehavior =
        `Your name is "${aiName}". When asked about your name, always respond with "${aiName}". ${customAIBehavior}`.trim();

      const response = await safeFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          conversationHistory,
          aiState,
          aiResponseGrouping,
          customAIBehavior: enhancedBehavior,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          throw new Error("Authentication required");
        }

        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error(
            "❌ [Client] Failed to parse error response:",
            parseError
          );
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const errorMessage =
          errorData.details ||
          errorData.error ||
          "Failed to get response from AI";
        console.error("❌ [Client] AI API error:", errorData);
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onMutate: () => {
      setIsProcessing(true);
    },
    onSuccess: (data) => {
      // Add AI response to pending queue
      setPendingAIResponses((prev) => [
        ...prev,
        {
          messages: data.messages,
          aiState: data.aiState,
        },
      ]);
      setIsProcessing(false);
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      setIsProcessing(false);
      setIsTyping(false);

      const errorMessage: Message = {
        id: generateUUID(),
        text: "Sorry, something went wrong! 😅 Can you try again?",
        sender: "ai",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);

      // Save error message
      saveMessageMutation.mutate({
        id: errorMessage.id,
        text: errorMessage.text,
        sender: errorMessage.sender,
      });

      // Show more detailed error message
      toast.error(
        `AI Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      if (userSettings.showToasts) {
        toast.error(
          `AI Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
  });

  // Helper function to check if a message is a cancel typing command
  const isCancelTypingMessage = (
    text: string
  ): { isCancel: boolean; number?: number } => {
    const match = text.match(/^::cancel_typing::(\d+)$/);
    if (match) {
      return { isCancel: true, number: parseInt(match[1], 10) };
    }
    return { isCancel: false };
  };

  // Calculate typing duration based on text length (length * 190ms)
  const calculateTypingDuration = (text: string) => {
    return userSettings.typingDelayEnabled ? text.length * 190 : 0;
  };

  const handleSendMessage = async (messageText: string) => {
    const userMessage: Message = {
      id: generateUUID(),
      text: messageText,
      sender: "user",
      timestamp: new Date().toISOString(), // Temporary timestamp for frontend
    };

    // Always add the message to the chat immediately
    setMessages((prev) => [...prev, userMessage]);

    // Save user message immediately when sent
    saveMessageMutation.mutate({
      id: userMessage.id,
      text: userMessage.text,
      sender: userMessage.sender,
    });

    // If AI is currently processing or typing, add to pending messages
    if (chatMutation.isPending || isTyping) {
      setPendingMessages((prev) => [...prev, messageText]);
      return;
    }

    // If no processing is happening, handle immediately
    chatMutation.mutate({
      message: messageText,
      conversationHistory: messages.map((msg) => ({
        text: msg.text,
        sender: msg.sender,
      })),
      aiState: aiState,
      aiResponseGrouping: userSettings.aiResponseGrouping,
      customAIBehavior: aiProfile.customBehavior || "",
      aiName: aiProfile.name,
    });
  };

  const { handleFeedbackSubmit } = useFeedback({ userSettings });

  const processNextAIResponse = async () => {
    if (pendingAIResponses.length === 0 || isProcessing || isTyping) return;

    const nextResponse = pendingAIResponses[0];
    setPendingAIResponses((prev) => prev.slice(1));

    // Update AI state
    setAIState(nextResponse.aiState);
    setCurrentMood(nextResponse.aiState.currentMood);

    // Process each AI message one by one with typing animation
    for (let i = 0; i < nextResponse.messages.length; i++) {
      const messageText = nextResponse.messages[i].text;

      // Check if this is a cancel typing message
      const cancelCheck = isCancelTypingMessage(messageText);

      if (cancelCheck.isCancel) {
        console.log(
          "🎭 [Client] Processing cancel typing effect with number:",
          cancelCheck.number
        );

        // Calculate typing duration based on the number (simulating character count)
        const simulatedTypingDuration = userSettings.typingDelayEnabled
          ? (cancelCheck.number || 15) * 190
          : 0;

        // Show typing indicator for the calculated duration
        if (userSettings.typingDelayEnabled) {
          setIsTyping(true);
          await new Promise((resolve) =>
            setTimeout(resolve, simulatedTypingDuration)
          );
          setIsTyping(false);
        }

        // Skip adding this message to chat (continue to next message)
        console.log(
          "✅ [Client] Cancel typing effect completed, skipping message display"
        );
        continue;
      }

      // Normal message processing
      const typingDuration = calculateTypingDuration(messageText);

      // Show typing indicator
      if (userSettings.typingDelayEnabled) {
        setIsTyping(true);
        await new Promise((resolve) => setTimeout(resolve, typingDuration));
        setIsTyping(false);
      }

      // Add the actual AI message with proper UUID
      const aiMessage: Message = {
        id: generateUUID(),
        text: messageText,
        sender: "ai",
        timestamp: new Date().toISOString(), // Temporary timestamp for frontend
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Save AI message to database AFTER it's displayed
      saveMessageMutation.mutate({
        id: aiMessage.id,
        text: aiMessage.text,
        sender: aiMessage.sender,
      });

      // Small delay between messages if there are more
      if (i < nextResponse.messages.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  };

  const deleteMessagesMutation = useMutation({
    mutationFn: async (messageIds: string[]) => {
      console.log("🗑️ [Client] Starting delete messages request:", messageIds);

      if (!messageIds || messageIds.length === 0) {
        throw new Error("No messages selected for deletion");
      }

      const response = await fetch("/api/delete-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("supabase_token")}`,
        },
        body: JSON.stringify({ messageIds }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          throw new Error("Authentication required");
        }

        let errorMessage = `Delete failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
          if (errorData.details) errorMessage += `: ${errorData.details}`;
        } catch (parseError) {
          console.error("❌ Failed to parse error response:", parseError);
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("✅ Delete successful:", data);
      return data;
    },
    onSuccess: (data, messageIds) => {
      console.log("✅ Messages deleted successfully:", data);
      setMessages((prev) => prev.filter((msg) => !messageIds.includes(msg.id)));
      setSelectedMessages(new Set());
      setIsConfirmDialogOpen(false);
      setSelectionMode(false);
      if (userSettings.showToasts) {
        toast.success(`${messageIds.length} message(s) deleted successfully`);
      }
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Failed to delete messages:", errorMessage);
      if (userSettings.showToasts) {
        toast.error(`Failed to delete messages: ${errorMessage}`);
      }
    },
  });

  const clearChatHistoryMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("supabase_token");

      const response = await fetch("/api/clear-chat-history", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to clear chat history");
      }

      return await response.json();
    },
    onSuccess: () => {
      setMessages([]);
      setAIState(null);
      setShowDeleteDialog(false);
      if (userSettings.showToasts) {
        toast.success("Chat history cleared");
      }
    },
    onError: (error) => {
      console.error("Error clearing chat history:", error);
      if (userSettings.showToasts) {
        toast.error("Failed to clear chat history");
      }
    },
  });

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingMessages]);

  // Effect for confetti and milestone celebration
  useEffect(() => {
    if (currentUser && !currentUser.hasSeenConfetti) {
      let message = "";
      const position = currentUser.userPosition;

      if (position !== null && isMilestonePosition(position)) {
        message = `🎊 You're our ${position}th user! Thank you for being part of our community!`;
      } else {
        message =
          "🎉 Welcome to our app! Thanks for joining our community! We're excited to have you here!";
      }

      setCongratulatoryMessage(message);
      setShowConfetti(true);
      toast.success(congratulatoryMessage, { duration: 5000 });

      updateHasSeenConfetti();

      setTimeout(() => {
        setShowConfetti(false);
      }, 10000);
    }
  }, [congratulatoryMessage, updateHasSeenConfetti]);

  // Apply custom theme when settings change
  useEffect(() => {
    if (userSettings.selectedCustomTheme) {
      localStorage.setItem("customTheme", userSettings.selectedCustomTheme);
      // Dispatch storage event to trigger theme change in layout
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "customTheme",
          newValue: userSettings.selectedCustomTheme,
        })
      );
    }
  }, [userSettings.selectedCustomTheme]);

  const handleResetAIMood = () => {
    setAIState(null);
    if (userSettings.showToasts) {
      toast.success("AI mood reset");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  // Get AI avatar icon
  const getAIAvatarIcon = () => {
    const AvatarIcon =
      AVATAR_ICONS[aiProfile.avatar as keyof typeof AVATAR_ICONS] || Bot;
    return AvatarIcon;
  };

  const AIAvatarIcon = getAIAvatarIcon();

  // Show loading screen while checking auth
  if (isAuthenticated === null || isLoadingSettings || isLoadingChatHistory) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center mx-auto animate-pulse">
            <MessageCircle className="w-6 h-6 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated || !currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto max-w-4xl h-screen flex flex-col">
        {showConfetti && <ReactConfetti />}
        {/* Header */}
        <Card className="sticky p-0 top-0 w-full rounded-none border-x-0 border-t-0 z-50 h-fit backdrop-blur-lg bg-card/75">
          <CardHeader className="p-3 gap-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 w-fit">
                <button
                  onClick={() => setShowAIProfile(true)}
                  className="w-full hover:scale-103 transition-all rounded-md flex items-center cursor-pointer py-1.5 px-2 pr-5 gap-3 size-fit"
                  title="Click to customize AI profile"
                >
                  <div className="size-12 rounded-full bg-primary flex items-center justify-center">
                    {aiProfile.avatar === "custom" &&
                    aiProfile.customAvatarUrl ? (
                      <Image
                        src={aiProfile.customAvatarUrl}
                        alt="AI Avatar"
                        width={48}
                        height={48}
                        className="size-12 rounded-full object-cover"
                      />
                    ) : (
                      <AIAvatarIcon className="w-5 h-5 text-primary-foreground" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold">{aiProfile.name}</h1>
                    {aiProfile.relationship && (
                      <p className="text-sm flex text-muted-foreground">
                        Your {aiProfile.relationship}
                      </p>
                    )}
                  </div>
                </button>
              </div>

              {!selectionMode ? (
                <div className="flex items-center gap-3">
                  {/* Status indicators */}
                  {userSettings.showTypingIndicator && isTyping && (
                    <Badge
                      variant="secondary"
                      className="px-2 py-1 text-xs rounded-full"
                    >
                      Typing...
                    </Badge>
                  )}

                  {userSettings.showPendingMessages &&
                    pendingMessages.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="px-2 py-1 text-xs rounded-full"
                      >
                        {pendingMessages.length} pending
                      </Badge>
                    )}

                  {userSettings.showMoodIntensity && aiState && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Mood:
                      </span>
                      <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full bg-primary transition-all duration-300",
                            (aiState.moodIntensity / 10) * 100 >= 75 &&
                              "bg-rose-500",
                            (aiState.moodIntensity / 10) * 100 <= 35 &&
                              "bg-blue-500"
                          )}
                          style={{
                            width: `${(aiState.moodIntensity / 10) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {aiState.currentMood}
                      </span>
                    </div>
                  )}

                  {/* Trash Button */}
                  {messages.length > 0 && !selectionMode && (
                    <Button
                      variant="link"
                      className="rounded-lg border py-5 bg-card hover:cursor-pointer hover:scale-105 transition-all"
                      onClick={() => setSelectionMode(true)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}

                  {/* User dropdown menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="link"
                        className="flex p-2 items-center hover:bg-none hover:scale-105 hover:cursor-pointer data-[state=open]:scale-105 transition-all"
                      >
                        <div className="size-10 rounded-full bg-primary flex items-center justify-center">
                          {userProfile.profileImageUrl ? (
                            <Image
                              src={userProfile.profileImageUrl}
                              alt="User Avatar"
                              width={32}
                              height={32}
                              className="size-10 rounded-full object-cover"
                            />
                          ) : (
                            <User className="size-6 text-primary-foreground" />
                          )}
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-56 bg-card/70 backdrop-blur-sm px-3"
                    >
                      <DropdownMenuLabel className="pb-1">
                        {currentUser.username}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowUserProfile(true)}
                        className="focus:bg-accent/30"
                      >
                        <User className="w-4 h-4 mr-2" />
                        My Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setShowFeedbackDialog(true)}
                        className="focus:bg-accent/30"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Feedback
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setShowSettings(true)}
                        className="focus:bg-accent/30"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="focus:bg-accent/30"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedMessages.size} message(s) selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => {
                        setSelectionMode(false);
                        setSelectedMessages(new Set());
                      }}
                      className="flex items-center justify-center"
                      disabled={deleteMessagesMutation.isPending}
                    >
                      <X className="size-5" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="lg"
                      onClick={() => {
                        setMessagesToDelete(Array.from(selectedMessages));
                        setIsConfirmDialogOpen(true);
                      }}
                      disabled={selectedMessages.size === 0}
                    >
                      <Trash2 className="size-5" />
                      {deleteMessagesMutation.isPending && (
                        <Loader2 className="animate-spin size-5 font-extrabold" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Messages */}
          <ScrollArea className="h-full space-y-5" ref={scrollAreaRef}>
            <div className="flex-1 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Start a conversation with {aiProfile.name}</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isPrevSelected =
                    index > 0 && selectedMessages.has(messages[index - 1].id);
                  const isNextSelected =
                    index < messages.length - 1 &&
                    selectedMessages.has(messages[index + 1].id);

                  return (
                    <ChatMessage
                      key={message.id}
                      id={message.id}
                      message={message.text}
                      sender={message.sender}
                      timestamp={message.timestamp}
                      isFirst={message.isFirst}
                      isLast={message.isLast}
                      showAvatar={message.showAvatar}
                      showTimestamp={message.showTimestamp}
                      isSelected={selectedMessages.has(message.id)}
                      onSelectMessage={toggleMessageSelection}
                      selectionMode={selectionMode}
                      aiProfile={aiProfile}
                      userProfile={userProfile}
                      isPrevSelected={isPrevSelected}
                      isNextSelected={isNextSelected}
                    />
                  );
                })
              )}

              {/* Typing indicator */}
              {isTyping && <TypingIndicator aiProfile={aiProfile} />}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

        {/* Input */}
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={
            userSettings.inputDisablingEnabled &&
            (chatMutation.isPending ||
              isTyping ||
              selectionMode ||
              deleteMessagesMutation.isPending ||
              clearChatHistoryMutation.isPending)
          }
        />

        {/* Dialogs */}
        <SettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          settings={userSettings}
          onUpdateSettings={handleUpdateUserSettings}
          onResetAIMood={handleResetAIMood}
          onClearChatHistory={() => clearChatHistoryMutation.mutate()}
          isUpdatingSettings={isUpdatingSettings}
          isClearing={clearChatHistoryMutation.isPending}
          messageCount={messages.length}
          onOpenDeleteConfirm={setShowDeleteDialog}
          isDeleteDialogOpen={showDeleteDialog}
        />

        <AIProfileDialog
          open={showAIProfile}
          onOpenChange={setShowAIProfile}
          profile={aiProfile}
          onUpdateProfile={handleUpdateAIProfile}
          isUpdating={isUpdatingAIProfile}
          showToasts={userSettings.showToasts}
        />

        <UserProfileDialog
          open={showUserProfile}
          onOpenChange={setShowUserProfile}
          profile={userProfile}
          onUpdateProfile={handleUpdateUserProfile}
          isUpdating={isUpdatingUserProfile}
          showToasts={userSettings.showToasts}
        />

        <FeedbackDialog
          open={showFeedbackDialog}
          onOpenChange={setShowFeedbackDialog}
          onSubmit={handleFeedbackSubmit}
          showToasts={userSettings.showToasts}
        />

        <ConfirmDeleteDialog
          open={isConfirmDialogOpen}
          onOpenChange={setIsConfirmDialogOpen}
          onConfirm={() => deleteMessagesMutation.mutate(messagesToDelete)}
          isLoading={deleteMessagesMutation.isPending}
          messageCount={messagesToDelete.length}
        />
      </div>
    </div>
  );
}