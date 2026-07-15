/** Avatar route integration tests for storage-key contracts. */

import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearUploadTestState, createAnonymousSession } from '../../../../test/uploadTestSupport';

beforeEach(async () => {
  await clearUploadTestState();
});

describe('avatar storage keys', () => {
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
