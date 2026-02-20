
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/chat-panel-core/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ModelOption {
  value: string;
  label: string;
}

interface ModelSelectorProps {
  modelName?: string;
  onModelChange?: (model: string) => void;
  models?: ModelOption[];
}

export const DEFAULT_MODELS = [
  { value: 'sonnet', label: 'Sonnet 4.5' },
  { value: 'opus', label: 'Opus 4' },
  { value: 'haiku', label: 'Haiku 3.5' },
];

export function ModelSelector({
  modelName,
  onModelChange,
  models = DEFAULT_MODELS
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentModel = models.find(m => m.value === modelName) || models[0];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!onModelChange) {
    return null;
  }

  return (
    <div className="relative z-[200]" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
      >
        <span className="font-mono">{currentModel?.label}</span>
        <motion.svg
          className="h-3 w-3 transition-transform"
          animate={{ rotate: isOpen ? 180 : 0 }}
          viewBox="0 0 10 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M1 1l4 4 4-4" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute bottom-full left-0 mb-2 w-48 overflow-hidden rounded-xl border bg-popover shadow-lg z-[200]"
            style={{ backgroundColor: 'var(--popover, #fff)' }}
          >
            <div className="p-1">
              {models.map((opt) => (
                <button
                  key={opt.value}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors',
                    opt.value === modelName
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'hover:bg-accent/50'
                  )}
                  onClick={() => {
                    onModelChange(opt.value);
                    setIsOpen(false);
                  }}
                >
                  <span className="font-mono">{opt.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}