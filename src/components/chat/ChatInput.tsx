'use client';

import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="sticky bottom-0 flex gap-2 p-4 border-t border-border backdrop-blur-lg bg-card/75">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        disabled={disabled}
        className="flex-1 bg-background"
        autoFocus
      />
      <Button 
        type="submit" 
        disabled={!message.trim() || disabled}
        size="icon"
        className="shrink-0"
      >
        <Send size={16} />
      </Button>
    </form>
  );
}