import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { cn } from '@/chat-panel-core/lib/utils';
import {
  ArrowUpIcon,
  SquareIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CommandInput, BUILT_IN_COMMANDS } from './CommandInput';
import { Suggestion } from './Suggestion';
import type { SuggestionItem } from './Suggestion';
import type { CommandBadge, PopoverItem } from './CommandInput';

import { Attachments, type Attachment } from './Attachments';
import { SpeechInput, useSpeechRecognition } from './SpeechInput';
import { WorkingDirectory } from './WorkingDirectory';

interface MessageInputProps {
  onSend: (content: string, attachments?: Attachment[]) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  accept?: string;
  maxFiles?: number;
  maxFileSize?: number;
  enableSpeech?: boolean;
  enableAttachments?: boolean;
  onCommand?: (command: string) => void;
  suggestions?: Array<{ value: string; label: string; description?: string; icon?: any }>;
  workingDirectory?: string;
  onWorkingDirectoryChange?: (dir: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function MessageInput({
  onSend,
  onStop,
  disabled = false,
  isStreaming = false,
  placeholder = 'Message AI...',
  accept = 'image/*,.pdf,.doc,.docx,.txt',
  maxFiles = 5,
  maxFileSize = MAX_FILE_SIZE,
  enableSpeech = false,
  enableAttachments = true,
  onCommand,
  suggestions = [],
  workingDirectory,
  onWorkingDirectoryChange,
}: MessageInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Command and suggestion popover state
  const [popoverMode, setPopoverMode] = useState<'command' | 'suggestion' | null>(null);
  const [commandPopoverItems, setCommandPopoverItems] = useState<PopoverItem[]>([]);
  const [suggestionPopoverItems, setSuggestionPopoverItems] = useState<SuggestionItem[]>([]);
  const [popoverFilter, setPopoverFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [badge, setBadge] = useState<CommandBadge | null>(null);
  const [triggerPos, setTriggerPos] = useState<number | null>(null);

  // Add speech recognition hook
  const { isRecording, handleSpeechToggle } = useSpeechRecognition((transcript: string) => {
    // Handle speech result by appending to input value
    setInputValue(prev => prev + transcript);
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const commandPopoverRef = useRef<HTMLDivElement>(null);
  const suggestionPopoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle input change with command and suggestion detection
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }

    // Check for command trigger
    const lastSlashIndex = value.lastIndexOf('/');
    // Check for suggestion trigger (colon)
    const lastColonIndex = value.lastIndexOf(':');

    if (lastSlashIndex !== -1 && (lastSlashIndex === 0 || value[lastSlashIndex - 1] === ' ')) {
      // Check if there's a space after the slash (command already selected)
      const afterSlash = value.slice(lastSlashIndex + 1);
      const spaceAfterCommand = afterSlash.indexOf(' ');

      if (spaceAfterCommand === -1) {
        // Still typing command
        setPopoverMode('command');
        setTriggerPos(lastSlashIndex);
        setPopoverFilter(afterSlash);

        // Filter commands
        const filtered = BUILT_IN_COMMANDS.filter(cmd =>
          cmd.label.toLowerCase().includes(afterSlash.toLowerCase())
        );
        setCommandPopoverItems(filtered);
        setSuggestionPopoverItems([]);
        setSelectedIndex(0);
      } else {
        // Command selected, close popover
        closePopover();
      }
    } else if (suggestions.length > 0 && lastColonIndex !== -1 && (lastColonIndex === 0 || value[lastColonIndex - 1] === ' ')) {
      // Handle suggestion trigger
      const afterColon = value.slice(lastColonIndex + 1);
      const spaceAfterSuggestion = afterColon.indexOf(' ');

      if (spaceAfterSuggestion === -1) {
        // Still typing suggestion
        setPopoverMode('suggestion');
        setTriggerPos(lastColonIndex);
        setPopoverFilter(afterColon);

        // Filter suggestions
        const filtered = suggestions.filter(suggestion =>
          suggestion.label.toLowerCase().includes(afterColon.toLowerCase()) ||
          suggestion.value.toLowerCase().includes(afterColon.toLowerCase())
        );
        setSuggestionPopoverItems(filtered);
        setCommandPopoverItems([]);
        setSelectedIndex(0);
      } else {
        // Suggestion selected, close popover
        closePopover();
      }
    } else {
      closePopover();
    }
  }, [suggestions]);

  const closePopover = useCallback(() => {
    setPopoverMode(null);
    setCommandPopoverItems([]);
    setSuggestionPopoverItems([]);
    setPopoverFilter('');
    setSelectedIndex(0);
    setTriggerPos(null);
  }, []);

  const insertCommand = useCallback((item: PopoverItem) => {
    if (triggerPos === null) return;

    // Set badge for commands
    setBadge({
      command: item.value,
      description: item.description,
    });

    // Clear input and close popover
    setInputValue('');
    closePopover();
  }, [triggerPos, closePopover]);

  const insertSuggestion = useCallback((item: SuggestionItem) => {
    if (triggerPos === null) return;

    const before = inputValue.slice(0, triggerPos);
    const after = inputValue.slice(triggerPos + 1 + popoverFilter.length);

    // Update the input value by replacing the suggestion trigger and filter
    const newValue = before + item.value + ' ';  // Insert suggestion and add a space
    setInputValue(newValue);
    closePopover();

    // Trigger the suggestion callback if provided
    item.onClick?.();

    // Focus back on textarea
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [inputValue, triggerPos, popoverFilter, closePopover]);

  const selectSuggestionBadge = useCallback((item: SuggestionItem) => {
    // Update the input value with the suggestion
    const newValue = inputValue ? inputValue + ' ' + item.value + ' ' : item.value + ' ';
    setInputValue(newValue);

    // Trigger the suggestion callback if provided
    item.onClick?.();

    // Focus on the textarea
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [inputValue]);

  const removeBadge = useCallback(() => {
    setBadge(null);
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    const hasText = Boolean(trimmed);
    const hasAttachments = attachments.length > 0;

    if (!hasText && !hasAttachments && !badge) return;
    if (disabled || isStreaming) return;

    // Handle command
    if (badge) {
      onCommand?.(badge.command);
      const message = trimmed || `Execute ${badge.command}`;
      onSend(message, attachments);
      setBadge(null);
    } else {
      onSend(trimmed, attachments);
    }

    setInputValue('');
    setAttachments([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue, attachments, disabled, isStreaming, onSend, badge, onCommand]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Popover navigation for commands
      if (popoverMode === 'command' && commandPopoverItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % commandPopoverItems.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + commandPopoverItems.length) % commandPopoverItems.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          if (commandPopoverItems[selectedIndex]) {
            insertCommand(commandPopoverItems[selectedIndex]);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closePopover();
          return;
        }
      }

      // Popover navigation for suggestions
      if (popoverMode === 'suggestion' && suggestionPopoverItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestionPopoverItems.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestionPopoverItems.length) % suggestionPopoverItems.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          if (suggestionPopoverItems[selectedIndex]) {
            insertSuggestion(suggestionPopoverItems[selectedIndex]);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closePopover();
          return;
        }
      }

      // Backspace removes badge when input is empty
      if (e.key === 'Backspace' && badge && !inputValue) {
        e.preventDefault();
        removeBadge();
        return;
      }

      // Escape removes badge
      if (e.key === 'Escape' && badge) {
        e.preventDefault();
        removeBadge();
        return;
      }

      // Normal send
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [popoverMode, commandPopoverItems, suggestionPopoverItems, selectedIndex, insertCommand, insertSuggestion, closePopover, badge, inputValue, removeBadge, handleSubmit]
  );

  const handleInput = useCallback((value: string) => {
    setInputValue(value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, []);



  // Click outside to close popover
  useEffect(() => {
    if (!popoverMode) return;
    const handler = (e: MouseEvent) => {
      if (popoverMode === 'command' && commandPopoverRef.current && !commandPopoverRef.current.contains(e.target as Node)) {
        closePopover();
      } else if (popoverMode === 'suggestion' && suggestionPopoverRef.current && !suggestionPopoverRef.current.contains(e.target as Node)) {
        closePopover();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popoverMode, closePopover]);


  return (
    <div className="relative z-[60] bg-background/80 backdrop-blur-lg px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <div
          ref={dropZoneRef}
          className={cn(
            'relative rounded-2xl border-2 border-dashed transition-all duration-200',
            'bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring/50',
            'border-transparent hover:border-border'
          )}
        >
          <Suggestion
            badge={null}  // Don't use a badge for suggestions - they insert directly into input
            inputValue={inputValue}
            popoverMode={popoverMode === 'suggestion' ? 'suggestion' : null}
            popoverItems={suggestionPopoverItems}
            popoverFilter={popoverFilter}
            selectedIndex={selectedIndex}
            triggerPos={triggerPos}
            setBadge={() => {}}  // No-op since we don't use suggestion badges
            setInputValue={setInputValue}
            setPopoverMode={(mode) => setPopoverMode(mode)}
            setPopoverItems={setSuggestionPopoverItems}
            setPopoverFilter={setPopoverFilter}
            setSelectedIndex={setSelectedIndex}
            setTriggerPos={setTriggerPos}
            onSuggestionClick={(suggestion) => console.log('Suggestion clicked:', suggestion)}
            removeBadge={() => {}}  // No-op since we don't use suggestion badges
            insertSuggestion={insertSuggestion}
            closePopover={closePopover}
            handleInputChange={handleInputChange}
            handleKeyDown={handleKeyDown}
            textareaRef={textareaRef}
            popoverRef={suggestionPopoverRef}
            searchInputRef={searchInputRef}
            suggestionsBadges={suggestions}  // Pass the suggestions as badges
            onSelectSuggestionBadge={selectSuggestionBadge}  // Callback to handle suggestion badge selection
          />

          <CommandInput
            badge={badge}
            inputValue={inputValue}
            popoverMode={popoverMode === 'command' ? 'command' : null}
            popoverItems={commandPopoverItems}
            popoverFilter={popoverFilter}
            selectedIndex={selectedIndex}
            triggerPos={triggerPos}
            setBadge={setBadge}
            setInputValue={setInputValue}
            setPopoverMode={(mode) => setPopoverMode(mode)}
            setPopoverItems={setCommandPopoverItems}
            setPopoverFilter={setPopoverFilter}
            setSelectedIndex={setSelectedIndex}
            setTriggerPos={setTriggerPos}
            onCommand={onCommand}
            removeBadge={removeBadge}
            insertCommand={insertCommand}
            closePopover={closePopover}
            handleInputChange={handleInputChange}
            handleKeyDown={handleKeyDown}
            textareaRef={textareaRef}
            popoverRef={commandPopoverRef}
            searchInputRef={searchInputRef}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            placeholder={badge ? "Add details (optional), then press Enter..." : placeholder}
            value={inputValue}
            onChange={(e) => handleInputChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isStreaming}
            rows={1}
            className={cn(
              'w-full resize-none bg-transparent px-4 py-3 text-sm outline-none',
              'placeholder:text-muted-foreground min-h-[56px] max-h-[200px]',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          />

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border/50 px-4 py-2">
            {/* Left Tools */}
            <div className="flex items-center gap-1">
              {/* Working Directory */}
              <WorkingDirectory
                workingDirectory={workingDirectory}
                onWorkingDirectoryChange={onWorkingDirectoryChange}
              />

              {/* Attachments Preview */}
              <Attachments
                attachments={attachments}
                setAttachments={setAttachments}
                disabled={disabled || isStreaming}
                maxFiles={maxFiles}
                maxFileSize={maxFileSize}
                accept={accept}
                className=""
              />

              {/* Divider */}
              {enableAttachments && !disabled && (
                <div className="mx-1 h-4 w-px bg-border" />
              )}

              {/* Speech button */}
              <SpeechInput
                onSpeechToggle={handleSpeechToggle}
                isRecording={isRecording}
                enabled={enableSpeech}
                disabled={disabled}
              />
            </div>

            {/* Send / Stop button */}
            <AnimatePresence mode="wait">
              {isStreaming ? (
                <motion.button
                  key="stop"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  type="button"
                  onClick={onStop}
                  className="rounded-full bg-destructive p-2 text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  title="Stop generation"
                >
                  <SquareIcon className="h-4 w-4 fill-current" />
                </motion.button>
              ) : (
                <motion.button
                  key="send"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  type="button"
                  onClick={handleSubmit}
                  disabled={(!inputValue.trim() && attachments.length === 0 && !badge) || disabled}
                  className={cn(
                    'rounded-full p-2 transition-colors',
                    (inputValue.trim() || attachments.length > 0 || badge) && !disabled
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                  title="Send message (Enter)"
                >
                  <ArrowUpIcon className="h-4 w-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* Helper text */}
        <div className="mt-2 text-center">
          <p className="text-[10px] text-muted-foreground">
            Press Enter to send, Shift + Enter for new line
            {enableAttachments && ` · Drag & drop files (max ${maxFiles}, ${(maxFileSize / 1024 / 1024).toFixed(0)}MB each)`}
            {' · Type / for commands · Type : for suggestions'}
          </p>
        </div>
      </div>
    </div>
  );
}