/** Shared setup for account-avatar and share-image integration tests. */

import { env, SELF } from 'cloudflare:test';
import { expect } from 'vitest';

interface AnonymousAuthResponse {
  readonly access_token: string;
  readonly user: {
    readonly id: string;
  };
}

/** Distinct client addresses so anonymous sign-up budgets never collide across tests. */
let clientIpCounter = 0;
function nextClientIp(): string {
  clientIpCounter += 1;
  return `198.51.100.${clientIpCounter % 200}`;
}

export async function createAnonymousSession(): Promise<AnonymousAuthResponse> {
  const response = await SELF.fetch('https://test.local/auth/anonymous', {
    method: 'POST',
    // SELF.fetch bypasses the edge; the Worker requires the header Cloudflare always sets.
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': nextClientIp() },
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
