// src/cron/precompute.ts
// Cron触发器处理器 - 预计算任务

import { PrecomputeService } from '../services/precompute.service';
import type { Env } from '../types';

/**
 * 每小时预计算任务
 * 聚合上一小时的数据
 */
export async function handleHourlyPrecompute(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log('[Cron] Starting hourly precompute task', new Date().toISOString());
  
  const precomputeService = new PrecomputeService(env);
  
  try {
    // 记录任务开始
    await logTaskStart(env, 'hourly_precompute');
    
    // 执行预计算
    await precomputeService.precomputeHourlyStats();
    
    // 记录任务完成
    await logTaskComplete(env, 'hourly_precompute');
    
    console.log('[Cron] Hourly precompute completed successfully');
  } catch (error) {
    console.error('[Cron] Hourly precompute failed:', error);
    await logTaskError(env, 'hourly_precompute', error);
    throw error;
  }
}

/**
 * 每日预计算任务
 * 从小时统计聚合日统计
 */
export async function handleDailyPrecompute(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log('[Cron] Starting daily precompute task', new Date().toISOString());
  
  const precomputeService = new PrecomputeService(env);
  
  try {
    await logTaskStart(env, 'daily_precompute');
    await precomputeService.precomputeDailyStats();
    await logTaskComplete(env, 'daily_precompute');
    
    console.log('[Cron] Daily precompute completed successfully');
  } catch (error) {
    console.error('[Cron] Daily precompute failed:', error);
    await logTaskError(env, 'daily_precompute', error);
    throw error;
  }
}

/**
 * 每月预计算任务
 * 从日统计聚合月统计
 */
export async function handleMonthlyPrecompute(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log('[Cron] Starting monthly precompute task', new Date().toISOString());
  
  const precomputeService = new PrecomputeService(env);
  
  try {
    await logTaskStart(env, 'monthly_precompute');
    await precomputeService.precomputeMonthlyStats();
    await logTaskComplete(env, 'monthly_precompute');
    
    console.log('[Cron] Monthly precompute completed successfully');
  } catch (error) {
    console.error('[Cron] Monthly precompute failed:', error);
    await logTaskError(env, 'monthly_precompute', error);
    throw error;
  }
}

/**
 * 缓存清理任务
 * 清理过期的缓存数据
 */
export async function handleCacheCleanup(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log('[Cron] Starting cache cleanup task', new Date().toISOString());
  
  try {
    // 清理D1中的过期缓存
    const result = await env.DB.prepare(`
      DELETE FROM cache_store 
      WHERE expires_at < datetime('now')
    `).run();
    
    const deletedCount = result.meta?.changes || 0;
    console.log(`[Cron] Cleaned up ${deletedCount} expired cache entries`);
    
    // 记录清理日志
    await env.DB.prepare(`
      INSERT INTO precompute_logs (task_name, status, completed_at, records_processed)
      VALUES (?, ?, datetime('now'), ?)
    `).bind('cache_cleanup', 'completed', deletedCount).run();
    
  } catch (error) {
    console.error('[Cron] Cache cleanup failed:', error);
    throw error;
  }
}

// 辅助函数：记录任务日志
async function logTaskStart(env: Env, taskName: string): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO precompute_logs (task_name, status, started_at)
    VALUES (?, ?, datetime('now'))
  `).bind(taskName, 'running').run();
}

async function logTaskComplete(env: Env, taskName: string): Promise<void> {
  await env.DB.prepare(`
    UPDATE precompute_logs 
    SET status = ?, completed_at = datetime('now')
    WHERE task_name = ? AND status = ?
    ORDER BY started_at DESC
    LIMIT 1
  `).bind('completed', taskName, 'running').run();
}

async function logTaskError(env: Env, taskName: string, error: unknown): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  await env.DB.prepare(`
    UPDATE precompute_logs 
    SET status = ?, completed_at = datetime('now'), error_message = ?
    WHERE task_name = ? AND status = ?
    ORDER BY started_at DESC
    LIMIT 1
  `).bind('failed', errorMessage, taskName, 'running').run();
}
