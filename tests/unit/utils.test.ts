/**
 * 单元测试 - 工具函数
 */

import { describe, it, expect } from 'vitest';
import {
  generateId,
  generateClickId,
  generateConversionId,
  parseUserAgent,
  formatDate,
  getDatePartition,
  buildUrl,
  replaceMacros,
  isValidEmail,
  isValidUrl,
  calculateMetrics,
} from '../../src/utils';

describe('generateId', () => {
  it('should generate a unique ID', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(id1.length).toBe(16);
  });

  it('should generate ID with prefix', () => {
    const id = generateId('cp');
    expect(id.startsWith('cp_')).toBe(true);
  });
});

describe('generateClickId', () => {
  it('should generate a valid click ID', () => {
    const clickId = generateClickId();
    expect(clickId.startsWith('clk_')).toBe(true);
  });
});

describe('generateConversionId', () => {
  it('should generate a valid conversion ID', () => {
    const conversionId = generateConversionId();
    expect(conversionId.startsWith('conv_')).toBe(true);
  });
});

describe('parseUserAgent', () => {
  it('should detect Chrome on Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const result = parseUserAgent(ua);
    
    expect(result.deviceType).toBe('desktop');
    expect(result.os).toBe('Windows');
    expect(result.browser).toBe('Chrome');
  });

  it('should detect Safari on iPhone', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const result = parseUserAgent(ua);
    
    expect(result.deviceType).toBe('mobile');
    expect(result.os).toBe('iOS');
    expect(result.browser).toBe('Safari');
  });

  it('should detect iPad', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const result = parseUserAgent(ua);
    
    expect(result.deviceType).toBe('tablet');
    expect(result.os).toBe('iOS');
  });

  it('should detect Android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    const result = parseUserAgent(ua);
    
    expect(result.deviceType).toBe('mobile');
    expect(result.os).toBe('Android');
    expect(result.browser).toBe('Chrome');
  });
});

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const formatted = formatDate(date);
    expect(formatted).toContain('2024-01-15');
  });
});

describe('getDatePartition', () => {
  it('should return date in YYYY-MM-DD format', () => {
    const partition = getDatePartition('2024-01-15');
    expect(partition).toBe('2024-01-15');
  });
});

describe('buildUrl', () => {
  it('should build URL with query params', () => {
    const url = buildUrl('https://example.com/path', {
      clickid: 'clk_123',
      campaign: 'cp_abc',
    });
    
    expect(url).toContain('clickid=clk_123');
    expect(url).toContain('campaign=cp_abc');
  });

  it('should skip undefined params', () => {
    const url = buildUrl('https://example.com', {
      param1: 'value1',
      param2: undefined,
    });
    
    expect(url).toContain('param1=value1');
    expect(url).not.toContain('param2');
  });
});

describe('replaceMacros', () => {
  it('should replace macros in URL', () => {
    const url = 'https://offer.com?clickid={clickid}&campaign={campaign_id}';
    const macros = {
      clickid: 'clk_123',
      campaign_id: 'cp_abc',
    };
    
    const result = replaceMacros(url, macros);
    expect(result).toContain('clickid=clk_123');
    expect(result).toContain('campaign=cp_abc');
  });
});

describe('isValidEmail', () => {
  it('should validate correct emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('test@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('should validate correct URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000/path')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false);
  });
});

describe('calculateMetrics', () => {
  it('should calculate all metrics correctly', () => {
    const result = calculateMetrics(
      1000,  // impressions
      100,   // clicks
      10,    // conversions
      500,   // revenue
      200    // cost
    );
    
    expect(result.ctr).toBeCloseTo(10);      // 100/1000 * 100
    expect(result.cvr).toBeCloseTo(10);      // 10/100 * 100
    expect(result.epc).toBe(5);              // 500/100
    expect(result.cpc).toBe(2);              // 200/100
    expect(result.profit).toBe(300);         // 500 - 200
    expect(result.roi).toBeCloseTo(150);     // 300/200 * 100
  });

  it('should handle zero values', () => {
    const result = calculateMetrics(0, 0, 0, 0, 0);
    
    expect(result.ctr).toBe(0);
    expect(result.cvr).toBe(0);
    expect(result.epc).toBe(0);
    expect(result.cpc).toBe(0);
    expect(result.roi).toBe(0);
  });
});
