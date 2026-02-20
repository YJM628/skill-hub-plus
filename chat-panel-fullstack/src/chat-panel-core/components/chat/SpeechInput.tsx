'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { MicIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/chat-panel-core/lib/utils';

interface SpeechInputProps {
  onSpeechToggle: () => void;
  isRecording: boolean;
  enabled?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SpeechInput({
  onSpeechToggle,
  isRecording,
  enabled = true,
  disabled = false,
  className = ''
}: SpeechInputProps) {
  const handleClick = useCallback(() => {
    if (!enabled || disabled) return;
    onSpeechToggle();
  }, [enabled, disabled, onSpeechToggle]);

  if (!enabled || disabled) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors',
        isRecording
          ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
          : 'hover:bg-muted hover:text-foreground',
        className
      )}
      title={isRecording ? 'Stop recording' : 'Start voice input'}
    >
      <motion.div
        animate={isRecording ? { scale: [1, 1.2, 1] } : { scale: 1 }}
        transition={{ duration: 1.5, repeat: isRecording ? Infinity : 0 }}
      >
        <MicIcon className="h-4 w-4" />
      </motion.div>
    </button>
  );
}

// Hook for speech recognition functionality
export function useSpeechRecognition(onResult: (transcript: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const handleSpeechToggle = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported');
      return;
    }

    if (isRecording) {
      // Stop recording
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      // Start recording
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        onResult(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current.start();
      setIsRecording(true);
    }
  }, [isRecording, onResult]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isRecording,
    handleSpeechToggle
  };
}