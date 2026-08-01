/** Access-token persistence invariant tests. */

import { env } from 'cloudflare:test';
import { expect, it } from 'vitest';

import { bumpTokenVersion } from '../tokenAuth';

it('fails when asked to revoke tokens for a missing user', async () => {
  await expect(bumpTokenVersion('missing-user', env)).rejects.toThrow(
    'Expected one user while bumping token version, changed 0',
  );
});
