
import { useCallback, useEffect, useRef, type HTMLAttributes, type MouseEvent } from 'react';
import { cn } from '@/chat-panel-core/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80" onClick={() => onOpenChange(false)} />
      <div className="relative z-50">{children}</div>
    </div>
  );
}

interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  showCloseButton?: boolean;
}

export function DialogContent({ className, children, showCloseButton, ...props }: DialogContentProps) {
  const handleClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  return (
    <div 
      className={cn('relative rounded-lg bg-background shadow-lg', className)} 
      onClick={handleClick}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold', className)} {...props} />;
}