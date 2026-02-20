'use client';

import { useState } from 'react';
import { MessageSquareIcon, Settings } from 'lucide-react';
import { SettingsDialog } from '@/chat-panel-core/components/settings-dialog';
import { Button } from '@/chat-panel-core/components/ui/button';

export function Header() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-2">
          <MessageSquareIcon className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold">AI Chat Panel</h1>
        </div>
      </div>
    </header>
  );
}