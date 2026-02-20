import { useState, useCallback, useRef, type DragEvent } from 'react';
import { cn } from '@/chat-panel-core/lib/utils';
import {
  PaperclipIcon,
  XIcon,
  ImageIcon,
  FileTextIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string;
  preview?: string;
}

interface AttachmentsProps {
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  disabled?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  accept?: string;
  className?: string;
}

const DEFAULT_MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function Attachments({
  attachments,
  setAttachments,
  disabled = false,
  maxFiles = DEFAULT_MAX_FILES,
  maxFileSize = MAX_FILE_SIZE,
  accept = 'image/*,.pdf,.doc,.docx,.txt',
  className = ''
}: AttachmentsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const newAttachments: Attachment[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      // Check file count limit
      if (attachments.length + newAttachments.length >= maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        continue;
      }

      // Check file size
      if (file.size > maxFileSize) {
        errors.push(`${file.name} exceeds size limit`);
        continue;
      }

      // Read file content as base64
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });

      newAttachments.push({
        id: file.name,
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64Data.split(',')[1],
        preview: file.type.startsWith('image/') ? base64Data : undefined,
      });
    }

    if (errors.length > 0) {
      console.warn('File upload errors:', errors);
    }

    setAttachments((prev: Attachment[]) => [...prev, ...newAttachments]);
  }, [attachments, maxFiles, maxFileSize, setAttachments]);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev: Attachment[]) => prev.filter(att => att.id !== id));
  }, [setAttachments]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    handleFileSelect(files);
  }, [handleFileSelect]);

  const handleAttachmentClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className={className}>
      {/* Attachment button */}
      {!disabled && (
        <button
          type="button"
          onClick={handleAttachmentClick}
          disabled={attachments.length >= maxFiles}
          className={cn(
            'inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors',
            'hover:bg-muted hover:text-foreground',
            'disabled:cursor-not-allowed disabled:opacity-40'
          )}
          title={attachments.length >= maxFiles ? `Maximum ${maxFiles} files` : 'Add attachment'}
        >
          <PaperclipIcon className="h-4 w-4" />
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Attachments Preview Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-2xl border-2 border-dashed transition-all duration-200',
          isDragging ? 'border-primary bg-primary/5' : 'border-transparent'
        )}
      >
        {/* Attachments Preview */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-border px-4 py-3"
            >
              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <motion.div
                    key={attachment.id}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="group relative flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
                  >
                    {attachment.type.startsWith('image/') ? (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <FileTextIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="max-w-[150px] truncate">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      className="ml-1 rounded-md p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}