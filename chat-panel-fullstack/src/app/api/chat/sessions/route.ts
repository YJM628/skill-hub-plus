import { NextRequest, NextResponse } from 'next/server';
import { sessionStore } from '@/lib/session-store';

// GET /api/chat/sessions - 获取所有会话列表
export async function GET() {
  try {
    const sessions = sessionStore.getAllSessions();
    
    // 为每个会话生成标题（基于第一条用户消息）
    const sessionsWithTitles = sessions.map(session => {
      let title = session.title;
      
      // 如果没有标题，尝试从第一条用户消息生成
      if (!title && session.messages.length > 0) {
        const firstUserMessage = session.messages.find(msg => msg.role === 'user');
        if (firstUserMessage) {
          // 取前50个字符作为标题
          title = firstUserMessage.content.slice(0, 50);
          if (firstUserMessage.content.length > 50) {
            title += '...';
          }
        }
      }
      
      // 如果还是没有标题，使用默认标题
      if (!title) {
        title = '新会话';
      }
      
      return {
        id: session.id,
        title,
        created_at: session.created_at,
        updated_at: session.updated_at,
      };
    });
    
    return NextResponse.json({ sessions: sessionsWithTitles });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST /api/chat/sessions - 创建新会话
export async function POST() {
  try {
    const session = sessionStore.createSession();
    
    return NextResponse.json({ 
      session: {
        id: session.id,
        title: '新会话',
        created_at: session.created_at,
        updated_at: session.updated_at,
      }
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
