/** Share-image route integration tests for storage-key contracts. */

import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearUploadTestState, createAnonymousSession } from '../../../../test/uploadTestSupport';

beforeEach(async () => {
  await clearUploadTestState();
});

describe('share-image storage keys', () => {
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
});
