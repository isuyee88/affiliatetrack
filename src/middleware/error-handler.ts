/**
 * 错误处理中间件
 */

import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../types';

/**
 * 应用错误类型
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * 常见错误类型
 */
export const Errors = {
  BadRequest: (message: string = 'Bad Request', details?: any) =>
    new AppError(message, 400, 'BAD_REQUEST', details),
  
  Unauthorized: (message: string = 'Unauthorized') =>
    new AppError(message, 401, 'UNAUTHORIZED'),
  
  Forbidden: (message: string = 'Forbidden') =>
    new AppError(message, 403, 'FORBIDDEN'),
  
  NotFound: (resource: string = 'Resource') =>
    new AppError(`${resource} not found`, 404, 'NOT_FOUND'),
  
  Conflict: (message: string = 'Conflict') =>
    new AppError(message, 409, 'CONFLICT'),
  
  ValidationError: (details: any) =>
    new AppError('Validation failed', 422, 'VALIDATION_ERROR', details),
  
  Internal: (message: string = 'Internal Server Error') =>
    new AppError(message, 500, 'INTERNAL_ERROR'),
  
  ServiceUnavailable: (message: string = 'Service Unavailable') =>
    new AppError(message, 503, 'SERVICE_UNAVAILABLE'),
};

/**
 * 全局错误处理器
 */
export function errorHandler(err: Error, c: Context<{ Bindings: Env }>) {
  console.error('Error:', err);

  // 应用错误
  if (err instanceof AppError) {
    const response: any = {
      error: err.code || 'ERROR',
      message: err.message,
    };

    if (err.details) {
      response.details = err.details;
    }

    // 开发环境包含堆栈跟踪
    if (c.env.ENVIRONMENT === 'development') {
      response.stack = err.stack;
    }

    return c.json(response, err.statusCode as ContentfulStatusCode);
  }

  // Zod 验证错误
  if (err.name === 'ZodError') {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: (err as any).errors,
      },
      422
    );
  }

  // 其他错误
  const response: any = {
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  };

  // 开发环境包含详细信息
  if (c.env.ENVIRONMENT === 'development') {
    response.message = err.message;
    response.stack = err.stack;
  }

  return c.json(response, 500);
}

/**
 * 异步处理包装器
 */
export function asyncHandler(
  fn: (c: Context<{ Bindings: Env }>) => Promise<Response>
) {
  return async (c: Context<{ Bindings: Env }>) => {
    try {
      return await fn(c);
    } catch (error) {
      throw error; // 让全局错误处理器处理
    }
  };
}
