import { NextRequest } from 'next/server';
import { resolvePendingPermission } from '@/lib/permission-registry';
import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { permissionRequestId, decision } = body;

    if (!permissionRequestId || !decision) {
      return new Response(
        JSON.stringify({ error: 'Missing permissionRequestId or decision' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 将前端的 decision 格式转换为 PermissionResult 格式
    let permissionResult: PermissionResult;
    
    if (typeof decision === 'string') {
      // 简单格式: 'allow' 或 'deny'
      permissionResult = decision === 'deny'
        ? { behavior: 'deny', message: 'User denied permission' }
        : { behavior: 'allow' };
    } else if (decision.behavior) {
      // 完整格式: { behavior: 'allow' | 'deny', ... }
      permissionResult = decision as PermissionResult;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid decision format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 使用 permission-registry 解析权限请求
    const resolved = resolvePendingPermission(permissionRequestId, permissionResult);

    if (!resolved) {
      return new Response(
        JSON.stringify({ error: 'Permission request not found or already resolved' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        resolved: true
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Permission API error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}