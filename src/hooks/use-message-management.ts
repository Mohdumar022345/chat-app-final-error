import { toast } from 'sonner';
import { Message } from '@/types/chat';
import { SettingsState } from '@/components/SettingsDialog';

interface UseMessageManagementProps {
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setSelectedMessages: (messages: Set<string>) => void;
  setSelectionMode: (mode: boolean) => void;
  setAiState: (state: any) => void;
  userSettings: SettingsState;
}

export function useMessageManagement({
  setMessages,
  setSelectedMessages,
  setSelectionMode,
  setAiState,
  userSettings
}: UseMessageManagementProps) {

  const saveMessage = async (message: Message) => {
    try {
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        return;
      }

      await fetch('/api/save-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: message.id,
          text: message.text,
          sender: message.sender
        })
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const handleClearChatHistory = async () => {
    try {
      const token = localStorage.getItem('supabase_token');
      
      const response = await fetch('/api/clear-chat-history', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setMessages([]);
        setAiState(null);
        if (userSettings.showToasts) {
          toast.success('Chat history cleared');
        }
      } else {
        throw new Error('Failed to clear chat history');
      }
    } catch (error) {
      console.error('Error clearing chat history:', error);
      if (userSettings.showToasts) {
        toast.error('Failed to clear chat history');
      }
    }
  };

  const handleDeleteSelectedMessages = async (selectedMessages: Set<string>) => {
    if (selectedMessages.size === 0) return;

    try {
      const token = localStorage.getItem('supabase_token');
      
      const response = await fetch('/api/delete-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messageIds: Array.from(selectedMessages)
        })
      });

      if (response.ok) {
        setMessages(prev => prev.filter(msg => !selectedMessages.has(msg.id)));
        setSelectedMessages(new Set());
        setSelectionMode(false);
        
        if (userSettings.showToasts) {
          toast.success(`Deleted ${selectedMessages.size} message(s)`);
        }
      } else {
        throw new Error('Failed to delete messages');
      }
    } catch (error) {
      console.error('Error deleting messages:', error);
      if (userSettings.showToasts) {
        toast.error('Failed to delete messages');
      }
    }
  };

  return {
    saveMessage,
    handleClearChatHistory,
    handleDeleteSelectedMessages
  };
}