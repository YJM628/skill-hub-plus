import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { cn } from '@/chat-panel-core/lib/utils';
import { Trash2Icon, XIcon } from 'lucide-react';
import { BUILT_IN_COMMANDS, type CommandItem } from '@/chat-panel-core/config/commands';

export interface CommandBadge {
  command: string;
  description?: string;
}

export interface PopoverItem {
  value: string;
  label: string;
  description?: string;
  builtIn?: boolean;
  immediate?: boolean;
  icon?: any;
}

interface CommandInputProps {
  badge: CommandBadge | null;
  inputValue: string;
  popoverMode: 'command' | null;
  popoverItems: PopoverItem[];
  popoverFilter: string;
  selectedIndex: number;
  triggerPos: number | null;
  setBadge: (badge: CommandBadge | null) => void;
  setInputValue: (value: string) => void;
  setPopoverMode: (mode: 'command' | null) => void;
  setPopoverItems: (items: PopoverItem[]) => void;
  setPopoverFilter: (filter: string) => void;
  setSelectedIndex: (index: number) => void;
  setTriggerPos: (pos: number | null) => void;
  onCommand?: (command: string) => void;
  removeBadge: () => void;
  insertCommand: (item: PopoverItem) => void;
  closePopover: () => void;
  handleInputChange: (value: string) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  popoverRef: React.RefObject<HTMLDivElement>;
  searchInputRef: React.RefObject<HTMLInputElement>;
}

export function CommandInput({
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
  onCommand,
  removeBadge,
  insertCommand,
  closePopover,
  handleInputChange,
  handleKeyDown,
  textareaRef,
  popoverRef,
  searchInputRef,
}: CommandInputProps) {

  return (
    <>
      {/* Command popover */}
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
              placeholder="Search commands..."
              value={popoverFilter}
              onChange={(e) => {
                const val = e.target.value;
                setPopoverFilter(val);
                setSelectedIndex(0);
                // Sync textarea: replace the filter portion after /
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
                    insertCommand(popoverItems[selectedIndex]);
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
              Commands
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
                  onClick={() => insertCommand(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Trash2Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
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

      {/* Command badge */}
      {badge && (
        <div className="flex w-full items-center gap-1.5 px-4 pt-3 pb-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 pl-2.5 pr-1.5 py-1 text-xs font-medium border border-blue-500/20">
            <span className="font-mono">{badge.command}</span>
            {badge.description && (
              <span className="text-blue-500/60 dark:text-blue-400/60 text-[10px]">{badge.description}</span>
            )}
            <button
              type="button"
              onClick={removeBadge}
              className="ml-0.5 rounded-full p-0.5 hover:bg-blue-500/20 transition-colors"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}
    </>
  );
}

export { BUILT_IN_COMMANDS } from '@/chat-panel-core/config/commands';