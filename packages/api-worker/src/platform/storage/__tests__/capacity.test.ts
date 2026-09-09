/** Storage thresholds and recovery hysteresis. */
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import {
  determineDatabaseCapacityState,
  measureDatabaseCapacity,
  requireDatabaseGrowthCapacity,
} from '../capacity';

describe('database capacity', () => {
  it('pauses producers before protecting new accounts and resumes below lower watermarks', () => {
    expect(determineDatabaseCapacityState(300_000_000, 'normal')).toBe('warning');
    expect(determineDatabaseCapacityState(375_000_000, 'normal')).toBe('paused');
    expect(determineDatabaseCapacityState(360_000_000, 'paused')).toBe('paused');
    expect(determineDatabaseCapacityState(349_000_000, 'paused')).toBe('warning');
    expect(determineDatabaseCapacityState(425_000_000, 'paused')).toBe('protected');
    expect(determineDatabaseCapacityState(410_000_000, 'protected')).toBe('protected');
    expect(determineDatabaseCapacityState(399_000_000, 'protected')).toBe('paused');
  });
  it('measures D1 and rejects new growth while protected', async () => {
    expect(await measureDatabaseCapacity(env.DB)).toBe('normal');
    await env.DB.prepare("UPDATE database_capacity SET state = 'protected' WHERE id = 1").run();
    await expect(requireDatabaseGrowthCapacity(env.DB)).rejects.toThrow('存储空间不足');
  });
});
