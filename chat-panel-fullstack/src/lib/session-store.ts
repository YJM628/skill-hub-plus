import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  token_usage?: string | null;
}

export interface Session {
  id: string;
  title?: string; // 会话标题
  created_at: string;
  updated_at: string;
  sdk_session_id?: string; // Claude SDK 会话 ID，用于会话恢复
  messages: Message[];
}

export interface PermissionRequest {
  id: string;
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  decision_reason?: string;
}

// 内存存储 - 生产环境应替换为数据库
class SessionStore {
  private sessions = new Map<string, Session>();
  private permissions = new Map<string, PermissionRequest>();

  createSession(): Session {
    const session: Session = {
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [],
    };
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): Session | null {
    return this.sessions.get(sessionId) || null;
  }

  getOrCreateSession(sessionId: string): Session {
    const existing = this.getSession(sessionId);
    if (existing) return existing;

    const session: Session = {
      id: sessionId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [],
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  addMessage(sessionId: string, message: Omit<Message, 'id' | 'session_id' | 'created_at'>): Message {
    const session = this.getOrCreateSession(sessionId);
    const newMessage: Message = {
      id: uuidv4(),
      session_id: sessionId,
      created_at: new Date().toISOString(),
      ...message,
    };
    
    session.messages.push(newMessage);
    session.updated_at = new Date().toISOString();
    return newMessage;
  }

  getMessages(sessionId: string): Message[] {
    const session = this.getSession(sessionId);
    return session?.messages || [];
  }

  createPermissionRequest(
    sessionId: string,
    toolName: string,
    toolInput: Record<string, unknown>
  ): PermissionRequest {
    const permission: PermissionRequest = {
      id: uuidv4(),
      session_id: sessionId,
      tool_name: toolName,
      tool_input: toolInput,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    this.permissions.set(permission.id, permission);
    return permission;
  }

  updatePermissionRequest(
    permissionId: string,
    status: 'approved' | 'denied',
    reason?: string
  ): PermissionRequest | null {
    const permission = this.permissions.get(permissionId);
    if (!permission) return null;

    permission.status = status;
    permission.decision_reason = reason;
    return permission;
  }

  getPermissionRequest(permissionId: string): PermissionRequest | null {
    return this.permissions.get(permissionId) || null;
  }

  // 获取所有会话列表
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  // 删除会话
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  // 更新会话标题
  updateSessionTitle(sessionId: string, title: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    // 将标题存储在会话对象中（需要扩展 Session 接口）
    (session as any).title = title;
    session.updated_at = new Date().toISOString();
    return true;
  }

  // 更新会话的 SDK session ID
  updateSdkSessionId(sessionId: string, sdkSessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    session.sdk_session_id = sdkSessionId;
    session.updated_at = new Date().toISOString();
    return true;
  }

  // 清理过期会话（可选）
  cleanup(maxAgeHours = 24) {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (new Date(session.updated_at) < cutoff) {
        this.sessions.delete(sessionId);
      }
    }

    for (const [permissionId, permission] of this.permissions.entries()) {
      if (new Date(permission.created_at) < cutoff) {
        this.permissions.delete(permissionId);
      }
    }
  }
}

export const sessionStore = new SessionStore();