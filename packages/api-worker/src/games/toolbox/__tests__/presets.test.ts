import { SELF } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearUploadTestState, createAnonymousSession } from '../../../../test/uploadTestSupport';
import {
  pickMergedToolboxPresetName,
  TOOLBOX_PRESET_LIMIT_PER_ACCOUNT,
  TOOLBOX_PRESET_REASONS,
} from '../presets';

const URL = 'https://test.local/api/games/toolbox/presets';
const IDENTITY = {
  identities: [
    { name: '平民', description: '好人', count: 3 },
    { name: '卧底', description: '', count: 1 },
  ],
  cardsPerPlayer: 1,
};

interface PresetBody {
  readonly preset: { readonly id: string; readonly name: string; readonly version: number };
}

async function account() {
  const session = await createAnonymousSession();
  await env.DB.prepare('UPDATE users SET is_anonymous = 0 WHERE id = ?')
    .bind(session.user.id)
    .run();
  return session;
}

function call(token: string | null, method: string, path = '', body?: unknown) {
  return SELF.fetch(`${URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function create(token: string, name: string) {
  const response = await call(token, 'POST', '', { name, identity: IDENTITY });
  expect(response.status).toBe(201);
  return (await response.json<PresetBody>()).preset;
}

async function expectReason(response: Response, status: number, reason: string) {
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ success: false, reason });
}

beforeEach(async () => {
  await env.DB.exec('DELETE FROM toolbox_identity_presets;');
  await clearUploadTestState();
});

describe('toolbox presets API', () => {
  it('requires a signed-in, non-anonymous account', async () => {
    expect((await call(null, 'GET')).status).toBe(401);
    const anonymous = await createAnonymousSession();
    await expectReason(await call(anonymous.access_token, 'GET'), 403, 'ANONYMOUS_NOT_SUPPORTED');
  });

  it('creates normalized presets and lists only the own presets, newest update first', async () => {
    const owner = await account();
    const other = await account();
    const first = await create(owner.access_token, '  标准局 ');
    expect(first).toMatchObject({ name: '标准局', version: 1 });
    await create(owner.access_token, '第二套');
    await create(other.access_token, '别人的');
    await env.DB.exec(
      "UPDATE toolbox_identity_presets SET updated_at = '2026-01-01T00:00:00.000Z';",
    );
    await call(owner.access_token, 'PUT', `/${first.id}`, {
      name: '标准局',
      identity: IDENTITY,
      expectedVersion: 1,
    });

    const response = await call(owner.access_token, 'GET');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const { presets } = await response.json<{ presets: { name: string; identity: unknown }[] }>();
    expect(presets.map((preset) => preset.name)).toEqual(['标准局', '第二套']);
    expect(presets[0].identity).toEqual(IDENTITY);
  });

  it('rejects duplicate names, invalid names, invalid identities and the account cap', async () => {
    const { access_token: token, user } = await account();
    await create(token, '标准局');
    const post = (name: string, identity: unknown = IDENTITY) =>
      call(token, 'POST', '', { name, identity });
    await expectReason(await post(' 标准局'), 409, TOOLBOX_PRESET_REASONS.nameTaken);
    await expectReason(await post('   '), 400, TOOLBOX_PRESET_REASONS.nameInvalid);
    await expectReason(await post('名'.repeat(21)), 400, TOOLBOX_PRESET_REASONS.nameInvalid);
    await expectReason(
      await post('重名身份', {
        identities: [IDENTITY.identities[0], IDENTITY.identities[0]],
        cardsPerPlayer: 1,
      }),
      400,
      TOOLBOX_PRESET_REASONS.identityInvalid,
    );
    expect((await post('多余字段', { ...IDENTITY, extra: 1 })).status).toBe(400);

    await env.DB.batch(
      Array.from({ length: TOOLBOX_PRESET_LIMIT_PER_ACCOUNT - 1 }, (_, index) =>
        env.DB.prepare(
          `INSERT INTO toolbox_identity_presets
            (id, owner_user_id, name, normalized_name, config_json, version, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?3, ?4, 1, '2026-01-01', '2026-01-01')`,
        ).bind(`seed-${index}`, user.id, `方案${index}`, JSON.stringify(IDENTITY)),
      ),
    );
    await expectReason(await post('超出上限'), 409, TOOLBOX_PRESET_REASONS.limitReached);
  });

  it('updates with the expected version and rejects stale versions and duplicate names', async () => {
    const { access_token: token } = await account();
    const preset = await create(token, '标准局');
    await create(token, '第二套');
    const put = (name: string, expectedVersion: number, id = preset.id) =>
      call(token, 'PUT', `/${id}`, { name, identity: IDENTITY, expectedVersion });

    const saved = await put('改名局', 1);
    expect(saved.status).toBe(200);
    expect((await saved.json<PresetBody>()).preset).toMatchObject({ name: '改名局', version: 2 });
    await expectReason(await put('再改', 1), 409, TOOLBOX_PRESET_REASONS.versionConflict);
    await expectReason(await put('第二套', 2), 409, TOOLBOX_PRESET_REASONS.nameTaken);
    expect((await put('改名局', 2)).status).toBe(200);
    await expectReason(await put('任意', 1, 'missing'), 404, TOOLBOX_PRESET_REASONS.notFound);
  });

  it('never updates or deletes another account preset', async () => {
    const owner = await account();
    const intruder = await account();
    const preset = await create(owner.access_token, '标准局');
    await expectReason(
      await call(intruder.access_token, 'PUT', `/${preset.id}`, {
        name: '抢走',
        identity: IDENTITY,
        expectedVersion: 1,
      }),
      404,
      TOOLBOX_PRESET_REASONS.notFound,
    );
    await expectReason(
      await call(intruder.access_token, 'DELETE', `/${preset.id}`),
      404,
      TOOLBOX_PRESET_REASONS.notFound,
    );
    const deleted = await call(owner.access_token, 'DELETE', `/${preset.id}`);
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ success: true });
    await expectReason(
      await call(owner.access_token, 'DELETE', `/${preset.id}`),
      404,
      TOOLBOX_PRESET_REASONS.notFound,
    );
  });
});

describe('pickMergedToolboxPresetName', () => {
  it('appends the WeChat suffix, then numbered suffixes, trimming long names to the limit', () => {
    const taken = new Set(['标准局', '标准局（微信）']);
    expect(pickMergedToolboxPresetName('标准局', taken)).toBe('标准局（微信）2');
    expect(pickMergedToolboxPresetName('标准局', taken)).toBe('标准局（微信）3');
    const long = '长'.repeat(20);
    expect(pickMergedToolboxPresetName(long, new Set([long]))).toBe(`${'长'.repeat(16)}（微信）`);
    expect(pickMergedToolboxPresetName(long, new Set([`${'长'.repeat(16)}（微信）`]))).toBe(
      `${'长'.repeat(15)}（微信）2`,
    );
  });
});
