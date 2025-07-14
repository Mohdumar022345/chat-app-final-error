// components/chat/ChatMessage.tsx
'use client';

import { cn } from '@/lib/utils';
import { Bot, User, Check, Brain, Heart, Zap, Sparkles, Star, Crown, Smile, Coffee, MessageCircle, Image as LucideImage } from 'lucide-react';
import { AIProfile } from '@/components/AIProfileDialog';
import Image from 'next/image';

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
  custom: LucideImage,
};

interface ChatMessageProps {
  id: string;
  message: string;
  sender: 'user' | 'ai';
  timestamp: string;
  isFirst?: boolean;
  isLast?: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  isSelected?: boolean;
  onSelectMessage?: (id: string) => void;
  selectionMode?: boolean;
  aiProfile?: AIProfile;
  userProfile?: { profileImageUrl?: string };
  isPrevSelected?: boolean; // New prop
  isNextSelected?: boolean; // New prop
}

export function ChatMessage({ 
  id,
  message, 
  sender, 
  timestamp, 
  isFirst = false,
  isLast = false,
  showAvatar = true,
  showTimestamp = true,
  isSelected = false,
  onSelectMessage,
  selectionMode = false,
  aiProfile,
  userProfile,
  isPrevSelected = false, // Default to false
  isNextSelected = false, // Default to false
}: ChatMessageProps) {
  const isUser = sender === 'user';
  
  const handleClick = () => {
    if (selectionMode && onSelectMessage) {
      onSelectMessage(id);
    }
  };

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
    <div className={cn(
      'flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-300 relative',
      // Conditional vertical padding based on grouping
      isFirst && isLast ? 'py-2' : // Single message
      isFirst ? 'pt-2 pb-0.5' : // Start of a group
      isLast ? 'pt-0.5 pb-2' : // End of a group
      'py-0.5', // Middle of a group
      selectionMode ? 'pl-3 pr-10' : 'px-3', // Conditional horizontal padding for shift
      isUser ? 'flex-row-reverse' : 'flex-row',
      selectionMode && 'cursor-pointer',
      
      // Apply background if selected
      isSelected && 'bg-accent/30', 
      
      // Conditional rounding based on selection continuity
      isSelected && (
        (!isPrevSelected && !isNextSelected && 'rounded-lg') || // Single selected message
        (!isPrevSelected && isNextSelected && 'rounded-t-lg rounded-b-none') || // Start of a consecutive block
        (isPrevSelected && isNextSelected && 'rounded-none') ||    // Middle of a consecutive block
        (isPrevSelected && !isNextSelected && 'rounded-b-lg rounded-t-none') // End of a consecutive block
      )
    )}
    onClick={handleClick}
    >
      {/* Selection indicator */}
      {selectionMode && (
        <div className={cn(
          'absolute top-1/3 right-1 flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all', // Positioned to the right
          isSelected 
            ? 'bg-primary border-primary text-primary-foreground' 
            : 'border-border bg-background'
        )}>
          {isSelected && <Check className="w-3 h-3" />}
        </div>
      )}

      {/* Avatar - only show for first message in group */}
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        showAvatar ? 'opacity-100' : 'opacity-0',
        // Only apply background color if not using custom image
        !isUser || !userProfile?.profileImageUrl ? 'bg-primary text-primary-foreground' : '',
        isUser && userProfile?.profileImageUrl ? '' : '',
        !isUser && (!aiProfile || aiProfile.avatar !== 'custom' || !aiProfile.customAvatarUrl) ? 'bg-primary text-primary-foreground' : ''
      )}>
        {isUser ? (
          userProfile?.profileImageUrl ? (
            <Image 
              src={userProfile.profileImageUrl} 
              width={32}
              height={32}
              alt="User Avatar" 
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <User size={16} />
          )
        ) : (
          aiProfile?.avatar === 'custom' && aiProfile.customAvatarUrl ? (
            <Image
              src={aiProfile.customAvatarUrl} 
              width={32}
              height={32}
              alt="AI Avatar" 
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <AIIcon size={16} />
          )
        )}
      </div>
      
      <div className={cn(
        'flex flex-col max-w-[80%] sm:max-w-[70%]',
        isUser ? 'items-end' : 'items-start'
      )}>
        <div className={cn(
          'px-4 py-2 rounded-2xl break-words transition-all', // Changed break-words to break-all
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-secondary text-secondary-foreground',
          // Adjust border radius for grouped messages
          isUser ? (
            isFirst && isLast ? 'rounded-2xl' :
            isFirst ? 'rounded-2xl rounded-br-md' :
            isLast ? 'rounded-2xl rounded-tr-md' :
            'rounded-l-2xl rounded-r-md'
          ) : (
            isFirst && isLast ? 'rounded-2xl' :
            isFirst ? 'rounded-2xl rounded-bl-md' :
            isLast ? 'rounded-2xl rounded-tl-md' :
            'rounded-r-2xl rounded-l-md'
          ),
        )}>
          {message}
        </div>
        
        {/* Timestamp - only show for last message in group */}
        {showTimestamp && (
          <span className="text-xs text-muted-foreground mt-1 px-1">
            {new Date(timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        )}
      </div>
    </div>
  );
}
