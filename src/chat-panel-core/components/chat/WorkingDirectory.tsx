import { useState } from 'react';
import { cn } from '@/chat-panel-core/lib/utils';
import { FolderIcon, XIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface WorkingDirectoryProps {
  workingDirectory?: string;
  onWorkingDirectoryChange?: (dir: string) => void;
  className?: string;
}

export function WorkingDirectory({
  workingDirectory,
  onWorkingDirectoryChange,
  className = ''
}: WorkingDirectoryProps) {
  const [showWorkDirInput, setShowWorkDirInput] = useState(false);
  const [tempWorkDir, setTempWorkDir] = useState('');

  const handleDirectoryButtonClick = () => {
    if (!workingDirectory) {
      // If no working directory is set, try Tauri dialog first, fallback to manual input
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__;
      if (isTauri) {
        (async () => {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const dir = await invoke<string>('select_directory_dialog');
            if (dir) {
              onWorkingDirectoryChange?.(dir);
            }
          } catch (error) {
            console.error('Failed to select directory:', error);
            // Fallback to manual input on error
            setShowWorkDirInput(true);
          }
        })();
      } else {
        // Non-Tauri environment: show manual input
        setShowWorkDirInput(true);
      }
    } else {
      // If working directory exists, toggle input for editing
      setShowWorkDirInput(!showWorkDirInput);
    }
  };

  const handleFolderSelect = async () => {
    try {
      // Check if running in Tauri environment
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const dir = await invoke<string>('select_directory_dialog');
        if (dir) {
          onWorkingDirectoryChange?.(dir);
          setShowWorkDirInput(false);
          setTempWorkDir('');
        }
      }
    } catch (error) {
      // Silently handle errors (user cancelled or not in Tauri)
      console.error('Failed to select directory:', error);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onWorkingDirectoryChange?.(tempWorkDir || workingDirectory || '');
      setShowWorkDirInput(false);
      setTempWorkDir('');
    } else if (e.key === 'Escape') {
      setShowWorkDirInput(false);
      setTempWorkDir('');
    }
  };

  const handleClearDirectory = () => {
    onWorkingDirectoryChange?.('');
    setShowWorkDirInput(false);
    setTempWorkDir('');
  };

  return (
    <div className={className}>
      {/* Working Directory Button */}
      <button
        type="button"
        onClick={handleDirectoryButtonClick}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors',
          workingDirectory ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )}
        title={workingDirectory ? `Working directory: ${workingDirectory}. Click to edit or clear.` : 'Click to select working directory'}
      >
        <FolderIcon className="h-3.5 w-3.5" />
        <span className="max-w-[150px] truncate">
          {workingDirectory || 'No workspace'}
        </span>
      </button>

      {/* Working Directory Input (shown when editing or setting directory) */}
      {showWorkDirInput && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className="flex items-center gap-1"
        >
          <button
            type="button"
            onClick={handleFolderSelect}
            className="h-7 rounded-md bg-primary px-2 text-xs text-primary-foreground hover:bg-primary/90"
            title="Select folder"
          >
            <FolderIcon className="h-3 w-3" />
          </button>
          <input
            type="text"
            value={tempWorkDir || workingDirectory || ''}
            onChange={(e) => setTempWorkDir(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Enter path or click folder icon"
            className="h-7 w-[200px] rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <button
            type="button"
            onClick={handleClearDirectory}
            className="h-7 rounded-md bg-muted px-2 text-xs text-muted-foreground hover:bg-muted/80"
            title="Clear working directory"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
