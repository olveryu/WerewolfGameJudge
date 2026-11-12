import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readMaintenance, writeMaintenance } from '../maintenance';
import { adminRoutes } from '../routes';

const ADMIN_TOKEN = 'test-admin-token-do-not-use-in-production';
const configuration = {
  enabled: true,
  message: '数据库维护中，感谢你的耐心等待。',
  endsAt: '2099-01-02T09:00:00+08:00',
};

afterEach(async () => {
  vi.restoreAllMocks();
  await env.GAME_MEDIA.delete('system/maintenance.json');
});

describe('site maintenance without D1', () => {
  it('starts disabled and exposes an uncached public status without authentication', async () => {
    const response = await SELF.fetch('https://test.local/maintenance');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ enabled: false });
  });

  it('authenticates, saves, reads and disables maintenance even when D1 throws', async () => {
    const prepare = vi.spyOn(env.DB, 'prepare').mockImplementation(() => {
      throw new Error('D1 unavailable');
    });
    const headers = { 'X-Admin-Token': ADMIN_TOKEN, 'Content-Type': 'application/json' };
    const session = await adminRoutes.request('/session', { headers }, env);
    expect(session.status).toBe(200);
    const saved = await adminRoutes.request(
      '/maintenance',
      { method: 'POST', headers, body: JSON.stringify(configuration) },
      env,
    );
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual(configuration);
    expect(await readMaintenance(env)).toEqual(configuration);
    const publicStatus = await SELF.fetch('https://test.local/maintenance');
    expect(await publicStatus.json()).toEqual(configuration);
    const disabled = { ...configuration, enabled: false };
    const response = await adminRoutes.request(
      '/maintenance',
      { method: 'POST', headers, body: JSON.stringify(disabled) },
      env,
    );
    expect(response.status).toBe(200);
    expect(await readMaintenance(env)).toEqual(disabled);
    expect(prepare).not.toHaveBeenCalled();
  });

  it.each(['GET', 'POST'])('rejects unauthenticated %s access to settings', async (method) => {
    const response = await SELF.fetch('https://test.local/admin/maintenance', { method });
    expect(response.status).toBe(401);
  });

  it.each([
    { ...configuration, message: '   ' },
    { ...configuration, endsAt: '' },
    { ...configuration, enabled: 'true' },
    { ...configuration, unexpected: true },
    { ...configuration, endsAt: null },
    { ...configuration, endsAt: '2000-01-01T00:00:00Z' },
    { ...configuration, endsAt: '2099-01-02T09:00:00' },
    { ...configuration, endsAt: '2099-02-31T09:00:00Z' },
  ])('rejects invalid settings without replacing the saved configuration', async (invalid) => {
    await writeMaintenance(env, configuration);
    const response = await SELF.fetch('https://test.local/admin/maintenance', {
      method: 'POST',
      headers: { 'X-Admin-Token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(invalid),
    });
    expect(response.status).toBe(400);
    expect(await readMaintenance(env)).toEqual(configuration);
  });

  it('expires at the exact server deadline and does not rewrite the saved configuration', async () => {
    await writeMaintenance(env, configuration);
    const deadline = Date.parse(configuration.endsAt);
    const now = vi.spyOn(Date, 'now').mockReturnValue(deadline - 1);
    expect(await readMaintenance(env)).toEqual(configuration);
    now.mockReturnValue(deadline);
    expect(await readMaintenance(env)).toEqual({ ...configuration, enabled: false });
    now.mockReturnValue(deadline + 1);
    expect(await readMaintenance(env)).toEqual({ ...configuration, enabled: false });
    const saved = await env.GAME_MEDIA.get('system/maintenance.json');
    expect(await saved?.json()).toEqual(configuration);
  });

  it('reports an expired setting as disabled on the public and admin endpoints', async () => {
    const expired = { ...configuration, endsAt: '2000-01-01T00:00:00Z' };
    await writeMaintenance(env, expired);
    const response = await SELF.fetch('https://test.local/maintenance');
    expect(await response.json()).toEqual({ ...expired, enabled: false });
    const adminResponse = await SELF.fetch('https://test.local/admin/maintenance', {
      headers: { 'X-Admin-Token': ADMIN_TOKEN },
    });
    expect(await adminResponse.json()).toEqual({ ...expired, enabled: false });
  });

  it('does not silently disable maintenance when saved data is corrupt', async () => {
    await env.GAME_MEDIA.put('system/maintenance.json', '{"enabled":false}');
    const response = await SELF.fetch('https://test.local/maintenance');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, reason: 'INTERNAL_ERROR' });
  });
});
