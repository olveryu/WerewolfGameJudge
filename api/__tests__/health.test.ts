/**
 * Health API Route Tests — GET /api/health
 *
 * 验证 health endpoint 返回正确的环境诊断信息。
 *
 * ✅ 覆盖：200 响应、env flags
 * ❌ 无外部依赖
 */

import handler from '../health';
import { mockRequest, mockResponse } from './helpers';

describe('GET /api/health', () => {
  it('returns 200 with ok: true and env flags', async () => {
    const req = mockRequest({ method: 'GET' });
    const res = mockResponse();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json).toMatchObject({
      ok: true,
      env: {
        hasUrl: expect.any(Boolean),
        hasKey: expect.any(Boolean),
      },
      node: expect.stringMatching(/^v/),
    });
  });

  it('reflects SUPABASE_URL presence in env.hasUrl', async () => {
    const original = process.env.SUPABASE_URL;
    process.env.SUPABASE_URL = 'https://test.supabase.co';

    const req = mockRequest({ method: 'GET' });
    const res = mockResponse();
    await handler(req, res);

    expect((res._json as { env: { hasUrl: boolean } }).env.hasUrl).toBe(true);

    // Restore
    if (original === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = original;
    }
  });
});
