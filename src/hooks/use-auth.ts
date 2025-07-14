import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { CurrentUser } from '@/types/chat';
import { SettingsState } from '@/components/SettingsDialog';
import { AIProfile } from '@/components/AIProfileDialog';
import { UserProfile } from '@/types/user';

interface UseAuthProps {
  setIsAuthenticated: (value: boolean | null) => void;
  setCurrentUser: (user: CurrentUser | null) => void;
  setUserProfile: (profile: UserProfile) => void;
  setUserSettings: (settings: SettingsState) => void;
  setAiProfile: (profile: AIProfile) => void;
  setIsLoadingSettings: (loading: boolean) => void;
  setIsLoadingChatHistory: (loading: boolean) => void;
  setMessages: (messages: any) => void;
  userSettings: SettingsState;
}

export function useAuth({
  setIsAuthenticated,
  setCurrentUser,
  setUserProfile,
  setUserSettings,
  setAiProfile,
  setIsLoadingSettings,
  setIsLoadingChatHistory,
  setMessages,
  userSettings
}: UseAuthProps) {
  const router = useRouter();

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        setIsAuthenticated(false);
        router.push('/login');
        return;
      }

      // Store token for API calls
      localStorage.setItem('supabase_token', session.access_token);
      
      // Get user info
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get user data from our API
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        
        if (response.ok) {
          const { user: dbUser } = await response.json();
          setCurrentUser(dbUser);
          setUserProfile({
            id: dbUser.id,
            email: dbUser.email,
            username: dbUser.username,
            profileImageUrl: undefined, // Will be loaded from settings
            userPosition: dbUser.userPosition,
            hasSeenConfetti: dbUser.hasSeenConfetti
          });
          setIsAuthenticated(true);
          
          // Load user data and chat history after successful authentication
          await loadUserDataForUser(dbUser);
          await loadChatHistoryForUser(dbUser);
        } else {
          setIsAuthenticated(false);
          router.push('/login');
        }
      } else {
        setIsAuthenticated(false);
        router.push('/login');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      router.push('/login');
    }
  };

  const loadUserDataForUser = async (user: { id: string; email: string; username: string }) => {
    try {
      setIsLoadingSettings(true);
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        throw new Error('No auth token');
      }

      // Load user settings (includes AI profile and user avatar)
      const settingsResponse = await fetch('/api/user-settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (settingsResponse.ok) {
        const { settings } = await settingsResponse.json();
        
        // Update user settings
        setUserSettings({
          aiResponseGrouping: settings.aiResponseGrouping || 'human-like',
          typingDelayEnabled: settings.typingDelayEnabled ?? true,
          inputDisablingEnabled: settings.inputDisablingEnabled ?? true,
          showMoodIntensity: settings.showMoodIntensity ?? true,
          selectedCustomTheme: settings.selectedCustomTheme || 'none',
          showToasts: settings.showToasts ?? false,
          showTypingIndicator: settings.showTypingIndicator ?? true,
          showPendingMessages: settings.showPendingMessages ?? true,
          showProcessingStatus: settings.showProcessingStatus ?? true,
          congratulatedMilestones: settings.congratulatedMilestones || [],
        });
        
        // Update AI profile
        if (settings.aiProfile) {
          setAiProfile(settings.aiProfile);
        }
        
        // Update user profile with avatar
        setUserProfile(prev => ({
          id: user.id,
          email: user.email,
          username: user.username,
          profileImageUrl: settings.customUserAvatarUrl || prev.profileImageUrl
        }));
        
        if (userSettings.showToasts) {
          toast.success('Settings loaded successfully');
        }
      } else {
        console.error('Failed to load user settings');
        if (userSettings.showToasts) {
          toast.error('Failed to load settings');
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      if (userSettings.showToasts) {
        toast.error('Failed to load user data');
      }
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const loadChatHistoryForUser = async (user: { id: string; email: string; username: string }) => {
    try {
      setIsLoadingChatHistory(true);
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        setIsLoadingChatHistory(false);
        return;
      }

      const response = await fetch('/api/save-chat', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const { messages: chatHistory } = await response.json();
        
        // Transform messages and group them
        const transformedMessages = chatHistory.map((msg: any, index: number) => {
          const prevMsg = chatHistory[index - 1];
          const nextMsg = chatHistory[index + 1];
          
          const isFirst = !prevMsg || prevMsg.sender !== msg.sender;
          const isLast = !nextMsg || nextMsg.sender !== msg.sender;
          
          return {
            id: msg.id,
            text: msg.text,
            sender: msg.sender,
            timestamp: msg.created_at || msg.createdAt,
            isFirst,
            isLast,
            showAvatar: isFirst,
            showTimestamp: isLast
          };
        });
        
        setMessages(transformedMessages);
        
        if (userSettings.showToasts) {
          toast.success(`Loaded ${transformedMessages.length} messages`);
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      if (userSettings.showToasts) {
        toast.error('Failed to load chat history');
      }
    } finally {
      setIsLoadingChatHistory(false);
    }
  };

  const updateHasSeenConfetti = async () => {
    try {
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        console.error('No auth token available');
        return;
      }

      const response = await fetch('/api/update-confetti-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ hasSeenConfetti: true })
      });

      if (response.ok) {
        // Optimistically update local state
        setCurrentUser(prev => prev ? { ...prev, hasSeenConfetti: true } : null);
        console.log('✅ Confetti status updated successfully');
      } else {
        console.error('❌ Failed to update confetti status');
      }
    } catch (error) {
      console.error('❌ Error updating confetti status:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('supabase_token');
      
      // Call logout API
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear local storage
      localStorage.removeItem('supabase_token');
      
      // Redirect to login
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout fails
      router.push('/login');
    }
  };

  return {
    checkAuth,
    loadUserDataForUser,
    loadChatHistoryForUser,
    updateHasSeenConfetti,
    handleLogout
  };
}