'use client';

import { cn } from '@/lib/utils';
import { Bot, Brain, Heart, Zap, Sparkles, Star, Crown, Smile, Coffee, MessageCircle } from 'lucide-react';
import { Image } from 'lucide-react';
import { AIProfile } from '@/components/AIProfileDialog';

// Avatar icon mapping (colors removed - now using theme colors)
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
  custom: Image,
};

interface TypingIndicatorProps {
  aiProfile?: AIProfile;
}

export function TypingIndicator({ aiProfile }: TypingIndicatorProps) {
  // Get AI avatar icon and color
  const getAIAvatar = () => {
    if (!aiProfile) {
      return { icon: Bot };
    }
    
    const AvatarIcon = AVATAR_ICONS[aiProfile.avatar as keyof typeof AVATAR_ICONS] || Bot;
    
    return { icon: AvatarIcon };
  };

  const { icon: AIIcon } = getAIAvatar();

  return (
    <div className="flex items-start gap-3 mb-4 animate-in slide-in-from-bottom-2 duration-300">
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        // Only apply background color if not using custom image
        (!aiProfile || aiProfile.avatar !== 'custom' || !aiProfile.customAvatarUrl) ? 'bg-primary text-primary-foreground' : ''
      )}>
        {aiProfile?.avatar === 'custom' && aiProfile.customAvatarUrl ? (
          <img 
            src={aiProfile.customAvatarUrl} 
            alt="AI Avatar" 
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <AIIcon size={16} />
        )}
      </div>
      
      <div className="bg-secondary px-4 py-3 rounded-2xl rounded-bl-md">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}