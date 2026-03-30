/**
 * 认证 API 路由
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, LoginRequest, LoginResponse } from '../types';
import { hashString } from '../utils';
import { generateToken } from '../middleware/auth';
import { Errors } from '../middleware/error-handler';
import { authMiddleware } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env }>();

// ============================================
// 登录
// ============================================

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

auth.post('/login', async (c) => {
  const body = await c.req.json();
  const { email, password } = loginSchema.parse(body);

  // 查找用户
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ? AND status = ?'
  )
    .bind(email, 'active')
    .first();

  if (!user) {
    throw Errors.Unauthorized('Invalid credentials');
  }

  // 验证密码
  const passwordHash = await hashString(password);
  if (passwordHash !== user.password_hash) {
    throw Errors.Unauthorized('Invalid credentials');
  }

  // 生成 Token
  const token = await generateToken(
    user.id as string,
    c.env.JWT_SECRET || 'default-secret',
    86400 // 24小时
  );

  // 更新最后登录时间
  await c.env.DB.prepare(
    "UPDATE users SET last_login_at = datetime('now') WHERE id = ?"
  )
    .bind(user.id)
    .run();

  const response: LoginResponse = {
    success: true,
    token,
    user: {
      id: user.id as string,
      email: user.email as string,
      name: user.name as string,
      role: user.role as 'admin' | 'manager' | 'user',
    },
  };

  return c.json(response);
});

// ============================================
// 登出
// ============================================

auth.post('/logout', authMiddleware, async (c) => {
  // 在实际应用中，可能需要将 token 加入黑名单
  // 这里简单返回成功
  return c.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// ============================================
// 刷新 Token
// ============================================

auth.post('/refresh', authMiddleware, async (c) => {
  const user = c.get('user');

  const token = await generateToken(
    user.id,
    c.env.JWT_SECRET || 'default-secret',
    86400
  );

  return c.json({
    success: true,
    token,
  });
});

// ============================================
// 获取当前用户信息
// ============================================

auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');

  // 获取用户的 API Keys
  const apiKeys = await c.env.DB.prepare(
    `SELECT id, name, permissions, expires_at, last_used_at, created_at 
     FROM api_keys 
     WHERE user_id = ?`
  )
    .bind(user.id)
    .all();

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
    },
    api_keys: apiKeys.results,
  });
});

// ============================================
// 修改密码
// ============================================

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});

auth.post('/change-password', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { current_password, new_password } = changePasswordSchema.parse(body);

  // 验证当前密码
  const currentHash = await hashString(current_password);
  if (currentHash !== user.password_hash) {
    throw Errors.Unauthorized('Current password is incorrect');
  }

  // 更新密码
  const newHash = await hashString(new_password);
  await c.env.DB.prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
  )
    .bind(newHash, user.id)
    .run();

  return c.json({
    success: true,
    message: 'Password changed successfully',
  });
});

export { auth as authRoutes };
