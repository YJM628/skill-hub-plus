import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/chat-panel-core/lib/utils';
import { PlusIcon, ClockIcon, Trash2Icon, ChevronDownIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatHeaderProps {
  currentSessionId: string;
  onNewSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function ChatHeader({
  currentSessionId,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
}: ChatHeaderProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load sessions list
  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat/sessions');
      if (response.ok) {
        const data = await response.json();
        if (data.sessions && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load sessions when dropdown opens
  useEffect(() => {
    if (isHistoryOpen) {
      loadSessions();
    }
  }, [isHistoryOpen, loadSessions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsHistoryOpen(false);
      }
    };

    if (isHistoryOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isHistoryOpen]);

  const handleDeleteSession = useCallback(
    async (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      
      if (!confirm('确定要删除这个会话吗？')) {
        return;
      }

      try {
        const response = await fetch(`/api/chat/sessions/${sessionId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          // Remove from local state
          setSessions(prev => prev.filter(s => s.id !== sessionId));
          
          // If deleting current session, create a new one
          if (sessionId === currentSessionId) {
            onNewSession();
          }
          
          onDeleteSession(sessionId);
        }
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    },
    [currentSessionId, onNewSession, onDeleteSession]
  );

  const handleSwitchSession = useCallback(
    (sessionId: string) => {
      if (sessionId !== currentSessionId) {
        onSwitchSession(sessionId);
      }
      setIsHistoryOpen(false);
    },
    [currentSessionId, onSwitchSession]
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getCurrentSessionTitle = () => {
    const currentSession = sessions.find(s => s.id === currentSessionId);
    return currentSession?.title || '新任务';
  };

  return (
    <div className="relative z-[70] border-b border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Current Session Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h2 className="text-sm font-medium text-foreground truncate">
            {getCurrentSessionTitle()}
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* New Session Button */}
          <button
            onClick={onNewSession}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5',
              'text-sm font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
            title="新建会话"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">新任务</span>
          </button>

          {/* History Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5',
                'text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isHistoryOpen && 'bg-accent text-accent-foreground'
              )}
              title="历史会话"
            >
              <ClockIcon className="h-4 w-4" />
              <span className="hidden sm:inline">修复请求超时间</span>
              <ChevronDownIcon
                className={cn(
                  'h-4 w-4 transition-transform',
                  isHistoryOpen && 'rotate-180'
                )}
              />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isHistoryOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    'absolute right-0 top-full mt-2 w-80',
                    'rounded-lg border border-border bg-popover shadow-lg',
                    'max-h-[400px] overflow-y-auto'
                  )}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      暂无历史会话
                    </div>
                  ) : (
                    <div className="py-2">
                      {sessions.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => handleSwitchSession(session.id)}
                          className={cn(
                            'group flex items-center justify-between px-4 py-3',
                            'cursor-pointer transition-colors',
                            'hover:bg-accent',
                            session.id === currentSessionId && 'bg-accent/50'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm font-medium">
                              {session.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(session.updated_at)}
                            </div>
                          </div>
                          
                          <button
                            onClick={(e) => handleDeleteSession(session.id, e)}
                            className={cn(
                              'ml-2 rounded p-1.5 opacity-0 transition-opacity',
                              'hover:bg-destructive/10 hover:text-destructive',
                              'group-hover:opacity-100',
                              'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                            )}
                            title="删除会话"
                          >
                            <Trash2Icon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
