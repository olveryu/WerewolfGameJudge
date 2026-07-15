/** Media upload route integration tests for storage-key contracts. */

import { env, SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { bootstrapTestSchema } from './testSchemaBootstrap';

interface AnonymousAuthResponse {
  readonly access_token: string;
  readonly user: {
    readonly id: string;
  };
}

async function createAnonymousSession(): Promise<AnonymousAuthResponse> {
  const response = await SELF.fetch('https://test.local/auth/anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  expect(response.status).toBe(200);
  return response.json<AnonymousAuthResponse>();
}

async function clearAvatarBucket(): Promise<void> {
  const objects = await env.AVATARS.list();
  await Promise.all(objects.objects.map(({ key }) => env.AVATARS.delete(key)));
}

beforeAll(async () => {
  await bootstrapTestSchema(env.DB);
});

beforeEach(async () => {
  await clearAvatarBucket();
  await env.DB.exec('DELETE FROM refresh_tokens; DELETE FROM user_stats; DELETE FROM users;');
});

describe('media storage keys', () => {
  it('keeps share-image suffixes at twelve hexadecimal characters', async () => {
    const session = await createAnonymousSession();
    const response = await SELF.fetch('https://test.local/share/image', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64: 'iVBORw0KGgo=' }),
    });

    expect(response.status).toBe(200);
    const stored = await env.AVATARS.list({ prefix: 'share/' });
    expect(stored.objects.map(({ key }) => key)).toEqual([
      expect.stringMatching(/^share\/\d+-[0-9a-f]{12}\.png$/),
    ]);
  });

  it('keeps avatar suffixes at eight hexadecimal characters', async () => {
    const session = await createAnonymousSession();
    const formData = new FormData();
    formData.set(
      'file',
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'avatar.png', {
        type: 'image/png',
      }),
    );

    const response = await SELF.fetch('https://test.local/avatar/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    });

    expect(response.status).toBe(200);
    const stored = await env.AVATARS.list({ prefix: `${session.user.id}/` });
    expect(stored.objects.map(({ key }) => key)).toEqual([
      expect.stringMatching(new RegExp(`^${session.user.id}/\\d+-[0-9a-f]{8}\\.png$`)),
    ]);
  });
});
