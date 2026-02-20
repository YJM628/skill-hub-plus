
import { useState, useCallback, useEffect, useRef } from 'react';
import type { Message } from '@/chat-panel-core/types';

interface UseChatMessagesProps {
  initialMessages?: Message[];
}

export function useChatMessages({ initialMessages = [] }: UseChatMessagesProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initialMessages.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, setMessages, addMessage, clearMessages };
}
