/**
 * 单元测试 - 中间件
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AppError, Errors } from '../../src/middleware/error-handler';

describe('AppError', () => {
  it('should create an error with status code', () => {
    const error = new AppError('Test error', 400, 'TEST_ERROR');
    
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.name).toBe('AppError');
  });
});

describe('Errors factory', () => {
  it('should create BadRequest error', () => {
    const error = Errors.BadRequest('Invalid input');
    
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Invalid input');
  });

  it('should create Unauthorized error', () => {
    const error = Errors.Unauthorized();
    
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('should create Forbidden error', () => {
    const error = Errors.Forbidden();
    
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('should create NotFound error', () => {
    const error = Errors.NotFound('Campaign');
    
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Campaign not found');
  });

  it('should create Conflict error', () => {
    const error = Errors.Conflict('Duplicate entry');
    
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
  });

  it('should create ValidationError with details', () => {
    const details = { field: 'email', message: 'Invalid email format' };
    const error = Errors.ValidationError(details);
    
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual(details);
  });

  it('should create Internal error', () => {
    const error = Errors.Internal();
    
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
  });

  it('should create ServiceUnavailable error', () => {
    const error = Errors.ServiceUnavailable('Database unavailable');
    
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
