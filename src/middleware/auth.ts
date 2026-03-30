/**
 * 认证中间件
 */

import type { Context, Next } from 'hono';
import type { Env, User, ApiContext } from '../types';
import { hashString } from '../utils';

// 扩展 Context 类型
declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    apiContext: ApiContext;
  }
}

/**
 * JWT 验证
 */
async function verifyJWT(token: string, secret: string): Promise<any> {
  try {
    // 简单的 JWT 解析 (生产环境应使用 jose 库)
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
      return null;
    }

    const payload = JSON.parse(atob(payloadB64));
    
    // 检查过期时间
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    // 验证签名 (简化版本，生产环境需要完整验证)
    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, data);
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
    
    if (signatureB64 !== expectedSignature.substring(0, signatureB64.length)) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * 认证中间件
 */
export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  const apiKeyHeader = c.req.header('X-API-Key');

  let user: User | null = null;
  let permissions: string[] = [];

  // 方式1: JWT Token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret');
    
    if (payload?.userId) {
      // 从数据库获取用户
      const result = await c.env.DB.prepare(
        'SELECT * FROM users WHERE id = ? AND status = ?'
      )
        .bind(payload.userId, 'active')
        .first<User>();
      
      if (result) {
        user = result;
        permissions = getRolePermissions(result.role);
      }
    }
  }

  // 方式2: API Key
  if (!user && apiKeyHeader) {
    const keyHash = await hashString(apiKeyHeader);
    
    const apiKey = await c.env.DB.prepare(
      `SELECT ak.*, u.* 
       FROM api_keys ak 
       JOIN users u ON ak.user_id = u.id 
       WHERE ak.key_hash = ? 
         AND (ak.expires_at IS NULL OR ak.expires_at > datetime('now'))
         AND u.status = 'active'`
    )
      .bind(keyHash)
      .first<any>();

    if (apiKey) {
      user = {
        id: apiKey.user_id,
        email: apiKey.email,
        password_hash: apiKey.password_hash,
        name: apiKey.name,
        role: apiKey.role,
        api_key: apiKey.api_key,
        status: apiKey.status,
        created_at: apiKey.created_at,
        updated_at: apiKey.updated_at,
        last_login_at: apiKey.last_login_at,
      };
      permissions = JSON.parse(apiKey.permissions || '[]');
      
      // 更新最后使用时间
      await c.env.DB.prepare(
        'UPDATE api_keys SET last_used_at = datetime("now") WHERE id = ?'
      ).bind(apiKey.id).run();
    }
  }

  // 未认证
  if (!user) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Valid authentication required',
      },
      401
    );
  }

  // 设置上下文
  c.set('user', user);
  c.set('apiContext', {
    user,
    permissions,
    ip: c.req.header('CF-Connecting-IP') || '0.0.0.0',
    userAgent: c.req.header('User-Agent') || '',
  });

  await next();
}

/**
 * 权限检查中间件
 */
export function requirePermission(permission: string) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const apiContext = c.get('apiContext');
    
    if (!apiContext?.permissions.includes(permission) && 
        !apiContext?.permissions.includes('admin')) {
      return c.json(
        {
          error: 'Forbidden',
          message: 'Insufficient permissions',
        },
        403
      );
    }
    
    await next();
  };
}

/**
 * 角色权限映射
 */
function getRolePermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
    admin: ['read', 'write', 'admin'],
    manager: ['read', 'write'],
    user: ['read'],
  };
  
  return permissions[role] || [];
}

/**
 * 生成 JWT Token
 */
export async function generateToken(
  userId: string,
  secret: string,
  expiresIn: number = 86400 // 24小时
): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresIn,
    })
  );
  
  const encoder = new TextEncoder();
  const data = encoder.encode(`${header}.${payload}`);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${header}.${payload}.${signatureB64}`;
}
