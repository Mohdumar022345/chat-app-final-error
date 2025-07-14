import { useState } from 'react';
import { toast } from 'sonner';
import { SettingsState } from '@/components/SettingsDialog';
import { AIProfile } from '@/components/AIProfileDialog';
import { UserProfile } from '@/types/user';
import { CurrentUser } from '@/types/chat';

interface UseSettingsAndProfileUpdatesProps {
  setUserSettings: (settings: SettingsState | ((prev: SettingsState) => SettingsState)) => void;
  setAiProfile: (profile: AIProfile | ((prev: AIProfile) => AIProfile)) => void;
  setUserProfile: (profile: UserProfile) => void;
  setCurrentUser: (user: CurrentUser | ((prev: CurrentUser | null) => CurrentUser | null)) => void;
  userSettings: SettingsState;
}

export function useSettingsAndProfileUpdates({
  setUserSettings,
  setAiProfile,
  setUserProfile,
  setCurrentUser,
  userSettings
}: UseSettingsAndProfileUpdatesProps) {
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [isUpdatingAIProfile, setIsUpdatingAIProfile] = useState(false);
  const [isUpdatingUserProfile, setIsUpdatingUserProfile] = useState(false);

  const handleUpdateUserSettings = async (newSettings: Partial<SettingsState>): Promise<boolean> => {
    try {
      setIsUpdatingSettings(true);
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch('/api/user-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {        
        // Update local state
        setUserSettings(prev => ({ ...prev, ...newSettings }));
        
        if (userSettings.showToasts) {
          toast.success('Settings updated successfully');
        }

        return true; 
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      if (userSettings.showToasts) {
        toast.error('Failed to update settings');
      }
      return false;
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleUpdateAIProfile = async (newProfile: Partial<AIProfile>): Promise<boolean> => {
    try {
      setIsUpdatingAIProfile(true);
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch('/api/ai-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newProfile)
      });

      if (response.ok) {        
        // Update local state
        setAiProfile(prev => ({ ...prev, ...newProfile }));
        
        if (userSettings.showToasts) {
          toast.success('AI profile updated successfully');
        }
        return true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update AI profile');
      }
    } catch (error) {
      console.error('Error updating AI profile:', error);
      if (userSettings.showToasts) {
        toast.error('Failed to update AI profile');
      }
      return false;
    } finally {
      setIsUpdatingAIProfile(false);
    }
  };

  const handleUpdateUserProfile = async (newProfile: Partial<UserProfile>): Promise<boolean> => {
    try {
      setIsUpdatingUserProfile(true);
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch('/api/user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newProfile)
      });

      if (response.ok) {
        const { profile: updatedProfile } = await response.json();
        
        // Update local state with the response from the server
        setUserProfile({
          id: updatedProfile.id,
          email: updatedProfile.email,
          username: updatedProfile.username,
          profileImageUrl: updatedProfile.profileImageUrl
        });
        
        // Update current user info
        setCurrentUser(prev => prev ? {
          ...prev,
          id: updatedProfile.id,
          email: updatedProfile.email,
          username: updatedProfile.username,
          userPosition: updatedProfile.userPosition || prev.userPosition,
          hasSeenConfetti: updatedProfile.hasSeenConfetti ?? prev.hasSeenConfetti
        } : null);
        
        // Also update settings if avatar changed
        if (newProfile.profileImageUrl !== undefined) {
          setUserSettings(prev => ({
            ...prev,
            customUserAvatarUrl: updatedProfile.profileImageUrl
          }));
        }
        
        if (userSettings.showToasts) {
          toast.success('Profile updated successfully');
        }

        return true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      if (userSettings.showToasts) {
        toast.error('Failed to update profile');
      }
      return false;
    } finally {
      setIsUpdatingUserProfile(false);
    }
  };

  return {
    handleUpdateUserSettings,
    handleUpdateAIProfile,
    handleUpdateUserProfile,
    isUpdatingSettings,
    isUpdatingAIProfile,
    isUpdatingUserProfile
  };
}