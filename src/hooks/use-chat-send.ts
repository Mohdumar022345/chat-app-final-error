// hooks/use-chat-send.ts
import { useRef } from "react";
import { toast } from "sonner";
import { Message, AIState } from "@/types/chat";
import { SettingsState } from "@/components/SettingsDialog";
import { AIProfile } from "@/components/AIProfileDialog";
import { generateUUID } from "@/lib/utils";

interface UseChatSendProps {
  messages: Message[];
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  setPendingMessages: (
    messages: string[] | ((prev: string[]) => string[])
  ) => void;
  aiState: AIState | null;
  setAiState: (state: AIState | null) => void;
  userSettings: SettingsState;
  aiProfile: AIProfile;
  saveMessage: (message: Message) => Promise<void>;
}

export function useChatSend({
  messages,
  setMessages,
  isTyping,
  setIsTyping,
  setPendingMessages,
  aiState,
  setAiState,
  userSettings,
  aiProfile,
  saveMessage,
}: UseChatSendProps) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || isTyping) return;

    // Create user message
    const userMessage: Message = {
      id: generateUUID(),
      text: messageText,
      sender: "user",
      timestamp: new Date().toISOString(),
      isFirst: true, // Will be updated below
      isLast: true, // Will be updated below
      showAvatar: true, // Will be updated below
      showTimestamp: true, // Will be updated below
    };

    // Optimistically add user message to chat and update grouping for previous message
    setMessages((prev) => {
      const updated = [...prev];
      if (updated.length > 0) {
        const lastMsg = updated[updated.length - 1];
        if (lastMsg.sender === "user") {
          lastMsg.isLast = false;
          lastMsg.showTimestamp = false;
          userMessage.isFirst = false;
          userMessage.showAvatar = false;
        }
      }
      return [...updated, userMessage];
    });

    // Save user message (this should happen after the optimistic update to ensure correct `messages` state for API call)
    await saveMessage(userMessage);

    // Set typing state unconditionally. The visibility of the indicator is controlled by userSettings.showTypingIndicator in app/page.tsx.
    // This ensures `isTyping` accurately reflects AI processing for input disabling.
    setIsTyping(true);

    try {
      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const token = localStorage.getItem("supabase_token");

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: messageText,
          conversationHistory: [...messages, userMessage].map((msg) => ({
            // Use the updated messages array
            text: msg.text,
            sender: msg.sender,
            timestamp: msg.timestamp,
          })),
          aiState,
          aiResponseGrouping: userSettings.aiResponseGrouping,
          customAIBehavior: aiProfile.customBehavior,
          aiRelationship: aiProfile.relationship,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();

      // Update AI state
      if (data.aiState) {
        setAiState(data.aiState);
      }

      // Handle AI messages
      if (data.messages && data.messages.length > 0) {
        const aiMessagesFromAPI = data.messages; // These are raw messages from API, not yet formatted

        for (let i = 0; i < aiMessagesFromAPI.length; i++) {
          const rawAIMessage = aiMessagesFromAPI[i];

          // Handle ::cancel_typing:: signal
          if (rawAIMessage.text.startsWith("::cancel_typing::")) {
            console.log(
              "Received ::cancel_typing:: signal. Stopping typing indicator."
            );
            setIsTyping(false); // Immediately stop typing
            setPendingMessages([]); // Clear any pending messages
            await new Promise((resolve) => setTimeout(resolve, 500)); // Short pause for cancellation
            continue; // Skip displaying this message
          }

          const formattedAIMessage: Message = {
            id: generateUUID(),
            text: rawAIMessage.text,
            sender: "ai" as const,
            timestamp: rawAIMessage.timestamp,
            isFirst: false, // Will be determined dynamically
            isLast: false, // Will be determined dynamically
            showAvatar: false, // Will be determined dynamically
            showTimestamp: false, // Will be determined dynamically
          };

          // Add to pending messages if enabled
          if (userSettings.showPendingMessages) {
            setPendingMessages((prev) => [...prev, formattedAIMessage.text]);
          }

          // Wait for typing delay if enabled
          if (userSettings.typingDelayEnabled) {
            const delay = Math.min(
              formattedAIMessage.text.length * 50 + 500,
              3000
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }

          // Remove from pending and add to messages
          if (userSettings.showPendingMessages) {
            setPendingMessages((prev) =>
              prev.filter((text) => text !== formattedAIMessage.text)
            );
          }

          // Crucial: Update messages state using a functional update to get the latest `prev`
          setMessages((prev) => {
            const updated = [...prev];
            const lastMsgInUI = updated[updated.length - 1];

            // Determine grouping properties based on the *current* `updated` array
            formattedAIMessage.isFirst =
              !lastMsgInUI || lastMsgInUI.sender !== formattedAIMessage.sender;

            // Look ahead to determine isLast: if next is user, or next is cancel_typing, or no next message
            const nextRawAIMessage = aiMessagesFromAPI[i + 1];
            formattedAIMessage.isLast =
              !nextRawAIMessage ||
              nextRawAIMessage.text.startsWith("::cancel_typing::") ||
              nextRawAIMessage.sender !== formattedAIMessage.sender;

            formattedAIMessage.showAvatar = formattedAIMessage.isFirst;
            formattedAIMessage.showTimestamp = formattedAIMessage.isLast;

            // If the previous message was from the same sender, update its `isLast` and `showTimestamp`
            if (
              lastMsgInUI &&
              lastMsgInUI.sender === formattedAIMessage.sender
            ) {
              lastMsgInUI.isLast = false;
              lastMsgInUI.showTimestamp = false;
            }

            updated.push(formattedAIMessage);
            return updated;
          });

          // Save message
          await saveMessage(formattedAIMessage);
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Error sending message:", error);
        if (userSettings.showToasts) {
          toast.error("Failed to send message");
        }
      }
    } finally {
      console.log("DEBUG: Setting isTyping to false in finally block.");
      setIsTyping(false);
      setPendingMessages([]);
    }
  };

  return {
    handleSendMessage,
  };
}
