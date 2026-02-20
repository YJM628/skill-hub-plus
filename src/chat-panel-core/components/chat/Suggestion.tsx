import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { cn } from '@/chat-panel-core/lib/utils';
import { LightbulbIcon, XIcon } from 'lucide-react';

export interface SuggestionItem {
  value: string;
  label: string;
  description?: string;
  icon?: any;
  onClick?: () => void;
}

export interface SuggestionBadge {
  suggestion: string;
  description?: string;
}

interface SuggestionProps {
  badge: SuggestionBadge | null;
  inputValue: string;
  popoverMode: 'suggestion' | null;
  popoverItems: SuggestionItem[];
  popoverFilter: string;
  selectedIndex: number;
  triggerPos: number | null;
  setBadge: (badge: SuggestionBadge | null) => void;
  setInputValue: (value: string) => void;
  setPopoverMode: (mode: 'suggestion' | null) => void;
  setPopoverItems: (items: SuggestionItem[]) => void;
  setPopoverFilter: (filter: string) => void;
  setSelectedIndex: (index: number) => void;
  setTriggerPos: (pos: number | null) => void;
  onSuggestionClick?: (suggestion: string) => void;
  removeBadge: () => void;
  insertSuggestion: (item: SuggestionItem) => void;
  closePopover: () => void;
  handleInputChange: (value: string) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  popoverRef: React.RefObject<HTMLDivElement>;
  searchInputRef: React.RefObject<HTMLInputElement>;
  suggestionsBadges?: SuggestionItem[];  // Array of suggestion badges to display
  onSelectSuggestionBadge?: (suggestion: SuggestionItem) => void;  // Callback when clicking a suggestion badge
}

export function Suggestion({
  badge,
  inputValue,
  popoverMode,
  popoverItems,
  popoverFilter,
  selectedIndex,
  triggerPos,
  setBadge,
  setInputValue,
  setPopoverMode,
  setPopoverItems,
  setPopoverFilter,
  setSelectedIndex,
  setTriggerPos,
  onSuggestionClick,
  removeBadge,
  insertSuggestion,
  closePopover,
  handleInputChange,
  handleKeyDown,
  textareaRef,
  popoverRef,
  searchInputRef,
  suggestionsBadges = [],
  onSelectSuggestionBadge,
}: SuggestionProps) {

  return (
    <>
      {/* Suggestion popover */}
      {popoverMode && popoverItems.length > 0 && (
        <div
          ref={popoverRef}
          className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border bg-popover backdrop-blur-md shadow-2xl overflow-hidden z-[200]"
          style={{ backgroundColor: 'var(--popover, #fff)' }}
        >
          <div className="px-3 py-2 border-b">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search suggestions..."
              value={popoverFilter}
              onChange={(e) => {
                const val = e.target.value;
                setPopoverFilter(val);
                setSelectedIndex(0);
                // Sync textarea: replace the filter portion after trigger character
                if (triggerPos !== null) {
                  const before = inputValue.slice(0, triggerPos + 1);
                  setInputValue(before + val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedIndex((selectedIndex + 1) % popoverItems.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedIndex((selectedIndex - 1 + popoverItems.length) % popoverItems.length);
                } else if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  if (popoverItems[selectedIndex]) {
                    insertSuggestion(popoverItems[selectedIndex]);
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  closePopover();
                  textareaRef.current?.focus();
                }
              }}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Suggestions
            </div>
            {popoverItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={`${idx}-${item.value}`}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                    idx === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  )}
                  onClick={() => insertSuggestion(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" /> : <LightbulbIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="font-mono text-xs truncate">{item.label}</span>
                  {item.description && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {item.description}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggestion badge */}
      {badge && (
        <div className="flex w-full items-center gap-1.5 px-4 pt-3 pb-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 pl-2.5 pr-1.5 py-1 text-xs font-medium border border-green-500/20">
            <span className="font-mono">{badge.suggestion}</span>
            {badge.description && (
              <span className="text-green-500/60 dark:text-green-400/60 text-[10px]">{badge.description}</span>
            )}
            <button
              type="button"
              onClick={removeBadge}
              className="ml-0.5 rounded-full p-0.5 hover:bg-green-500/20 transition-colors"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      {/* Render suggestion badges as clickable elements */}
      {suggestionsBadges && suggestionsBadges.length > 0 && (
        <div className="relative flex w-full gap-2 px-4 pt-2 pb-1 flex-wrap">
          {suggestionsBadges.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onSelectSuggestionBadge?.(suggestion)}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 text-xs font-medium border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
            >
              <span className="font-mono">{suggestion.label}</span>
              {suggestion.description && (
                <span className="text-blue-500/60 dark:text-blue-400/60 text-[10px]">{suggestion.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}