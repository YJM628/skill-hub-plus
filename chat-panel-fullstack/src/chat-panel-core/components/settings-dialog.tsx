'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/chat-panel-core/components/ui/button';
import { Input } from '@/chat-panel-core/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/chat-panel-core/components/ui/dialog';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  // 加载现有配置
  useEffect(() => {
    const savedApiKey = localStorage.getItem('ai_api_key') || '';
    const savedBaseUrl = localStorage.getItem('ai_base_url') || '';

    setApiKey(savedApiKey);
    setBaseUrl(savedBaseUrl);
  }, [open]);

  const handleSave = () => {
    // 保存配置到localStorage
    localStorage.setItem('ai_api_key', apiKey);
    localStorage.setItem('ai_base_url', baseUrl);

    // 关闭对话框
    onOpenChange(false);
  };

  const handleCancel = () => {
    // 重新加载之前的值以取消更改
    const savedApiKey = localStorage.getItem('ai_api_key') || '';
    const savedBaseUrl = localStorage.getItem('ai_base_url') || '';

    setApiKey(savedApiKey);
    setBaseUrl(savedBaseUrl);

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md max-w-[90vw] p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl"
      >
        <DialogTitle className="mb-4 text-gray-900 dark:text-gray-100">AI 代理设置</DialogTitle>

        <div className="space-y-4">
          <div>
            <label htmlFor="api-key" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              API 密钥
            </label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入您的 API 密钥"
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="base-url" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              基础 URL
            </label>
            <Input
              id="base-url"
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="w-full"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleCancel}
            className="relative z-10"
          >
            取消
          </Button>
          <Button 
            type="button" 
            onClick={handleSave}
            className="relative z-10"
          >
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}