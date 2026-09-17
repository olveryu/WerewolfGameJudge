/** Avatar route integration tests for storage-key contracts. */

import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearUploadTestState, createAnonymousSession } from '../../../../test/uploadTestSupport';

beforeEach(async () => {
  await clearUploadTestState();
});

describe('avatar storage keys', () => {
  it('keeps the committed object when uploads overlap', async () => {
    const session = await createAnonymousSession();
    const upload = () => {
      const formData = new FormData();
      formData.set('file', new File(['image'], 'avatar.png', { type: 'image/png' }));
      return SELF.fetch('https://test.local/avatar/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
    };
    const responses = await Promise.all([upload(), upload()]);
    expect(responses.some((response) => response.status === 200)).toBe(true);
    expect(responses.every((response) => response.status === 200 || response.status === 409)).toBe(
      true,
    );
    const current = await env.DB.prepare('SELECT avatar_url FROM users WHERE id = ?')
      .bind(session.user.id)
      .first<{ avatar_url: string }>();
    if (current === null) throw new Error('Expected avatar owner');
    expect((await SELF.fetch(current.avatar_url)).status).toBe(200);
    await expect
      .poll(async () =>
        (await env.AVATARS.list({ prefix: `${session.user.id}/` })).objects.map(({ key }) => key),
      )
      .toEqual([new URL(current.avatar_url).pathname.slice('/avatar/'.length)]);
  });

  it('keeps the active avatar after a failed profile write and cleans up on the next replacement', async () => {
    const session = await createAnonymousSession();
    const upload = () => {
      const formData = new FormData();
      formData.set(
        'file',
        new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'avatar.png', {
          type: 'image/png',
        }),
      );
      return SELF.fetch('https://test.local/avatar/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
    };
    const first = await upload();
    expect(first.status).toBe(200);
    const original = await first.json<{ url: string }>();
    await env.DB.prepare(
      `CREATE TRIGGER reject_avatar_update BEFORE UPDATE OF avatar_url ON users
      BEGIN SELECT RAISE(ABORT, 'test avatar write failure'); END;`,
    ).run();
    try {
      expect((await upload()).status).toBe(500);
      expect((await SELF.fetch(original.url)).status).toBe(200);
      expect(
        await env.DB.prepare('SELECT avatar_url FROM users WHERE id = ?')
          .bind(session.user.id)
          .first(),
      ).toEqual({ avatar_url: original.url });
    } finally {
      await env.DB.exec('DROP TRIGGER reject_avatar_update');
    }
    const replacement = await upload();
    expect(replacement.status).toBe(200);
    const current = await replacement.json<{ url: string }>();
    expect((await SELF.fetch(current.url)).status).toBe(200);
    await expect
      .poll(async () =>
        (await env.AVATARS.list({ prefix: `${session.user.id}/` })).objects.map(({ key }) => key),
      )
      .toEqual([new URL(current.url).pathname.slice('/avatar/'.length)]);
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
