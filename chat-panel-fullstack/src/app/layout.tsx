import type { Metadata } from 'next';
import './globals.css';

// 使用系统默认字体替代 Google Fonts，避免网络超时问题
const fontClassName = 'font-sans';

export const metadata: Metadata = {
  title: 'AI Chat Panel - Full Stack Demo',
  description: '基于 chat-panel-core 的完整前后端 AI 聊天解决方案',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={fontClassName}>
        {children}
      </body>
    </html>
  );
}