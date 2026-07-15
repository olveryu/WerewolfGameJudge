/** Shared setup for account-avatar and share-image integration tests. */

import { env, SELF } from 'cloudflare:test';
import { expect } from 'vitest';

interface AnonymousAuthResponse {
  readonly access_token: string;
  readonly user: {
    readonly id: string;
  };
}

export async function createAnonymousSession(): Promise<AnonymousAuthResponse> {
  const response = await SELF.fetch('https://test.local/auth/anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  expect(response.status).toBe(200);
  return response.json<AnonymousAuthResponse>();
}

export async function clearUploadTestState(): Promise<void> {
  const objects = await env.AVATARS.list();
  await Promise.all(objects.objects.map(({ key }) => env.AVATARS.delete(key)));
  await env.DB.exec('DELETE FROM refresh_tokens; DELETE FROM user_stats; DELETE FROM users;');
}
