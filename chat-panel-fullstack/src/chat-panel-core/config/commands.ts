import type { Message } from '@/chat-panel-core/types';
import {
  HelpCircleIcon,
  DeleteIcon,
  CoinsIcon,
  FileArchiveIcon,
  StethoscopeIcon,
  FileEditIcon,
  SearchIcon,
  TerminalIcon,
  BrainIcon,
} from 'lucide-react';

export interface CommandItem {
  value: string;
  label: string;
  description?: string;
  builtIn?: boolean;
  immediate?: boolean;
  icon?: any;
  execute?: (sessionId: string, addMessage: (message: Message) => void) => void;
}

// Built-in commands configuration
export const BUILT_IN_COMMANDS: CommandItem[] = [
  {
    label: 'help',
    value: '/help',
    description: 'Show available commands and tips',
    builtIn: true,
    immediate: true,
    icon: HelpCircleIcon,
    execute: (sessionId, addMessage) => {
      addMessage({
        id: Date.now().toString(),
        session_id: sessionId,
        role: 'assistant',
        content: `**Available Commands:**

- \`/help\` - Show this help message
- \`/clear\` - Clear conversation history
- \`/cost\` - Show token usage statistics
- \`/compact\` - Compress conversation context
- \`/doctor\` - Diagnose project health
- \`/init\` - Initialize CLAUDE.md for project
- \`/review\` - Review code quality
- \`/terminal-setup\` - Configure terminal settings
- \`/memory\` - Edit project memory file

Type \`/\` to see all available commands.`,
        created_at: new Date().toISOString(),
      });
    },
  },
  {
    label: 'clear',
    value: '/clear',
    description: 'Clear conversation history',
    builtIn: true,
    immediate: true,
    icon: DeleteIcon,
    execute: (_sessionId, _addMessage) => {
      if (confirm('Are you sure you want to clear the conversation history?')) {
        window.location.reload();
      }
    },
  },
  {
    label: 'cost',
    value: '/cost',
    description: 'Show token usage statistics',
    builtIn: true,
    immediate: true,
    icon: CoinsIcon,
    execute: (sessionId, addMessage) => {
      addMessage({
        id: Date.now().toString(),
        session_id: sessionId,
        role: 'assistant',
        content: '**Token Usage Statistics**\n\nThis feature requires backend integration to track token usage across sessions.',
        created_at: new Date().toISOString(),
      });
    },
  },
  {
    label: 'compact',
    value: '/compact',
    description: 'Compress conversation context',
    builtIn: true,
    icon: FileArchiveIcon,
  },
  {
    label: 'doctor',
    value: '/doctor',
    description: 'Diagnose project health',
    builtIn: true,
    icon: StethoscopeIcon,
  },
  {
    label: 'init',
    value: '/init',
    description: 'Initialize CLAUDE.md for project',
    builtIn: true,
    icon: FileEditIcon,
  },
  {
    label: 'review',
    value: '/review',
    description: 'Review code quality',
    builtIn: true,
    icon: SearchIcon,
  },
  {
    label: 'terminal-setup',
    value: '/terminal-setup',
    description: 'Configure terminal settings',
    builtIn: true,
    icon: TerminalIcon,
  },
  {
    label: 'memory',
    value: '/memory',
    description: 'Edit project memory file',
    builtIn: true,
    icon: BrainIcon,
  },
];

/**
 * Execute a built-in command if it has an execute handler
 * @param command - The command string to execute
 * @param sessionId - The current session ID
 * @param addMessage - Function to add a message to the chat
 * @returns true if the command was handled, false otherwise
 */
export function executeBuiltInCommand(
  command: string,
  sessionId: string,
  addMessage: (message: Message) => void
): boolean {
  const commandItem = BUILT_IN_COMMANDS.find((cmd) => cmd.value === command);
  
  if (commandItem?.execute) {
    commandItem.execute(sessionId, addMessage);
    return true;
  }
  
  return false;
}
