export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
  isFirst?: boolean;
  isLast?: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
}

export interface AIState {
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

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  userPosition: number | null;
  hasSeenConfetti: boolean;
}