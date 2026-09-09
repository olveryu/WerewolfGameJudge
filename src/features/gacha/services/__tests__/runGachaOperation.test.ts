/** Failed delivery retries the original persisted key rather than initiating another debit. */
import { CloudflareHttpError } from '@/services/cloudflare/cfFetch';
import type { IAuthService } from '@/services/types/IAuthService';

import { GachaOperationStore } from '../GachaOperationStore';
import { runGachaOperation } from '../runGachaOperation';

it('persists before sending and retries the original key after lost delivery', async () => {
  const values = new Map<string, string>();
  const store = new GachaOperationStore({
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
  });
  const session = { userId: 'user', initialUser: null };
  const auth = { getAuthSession: () => session } as IAuthService;
  const request = { operation: 'draw', drawType: 'normal', count: 1 } as const;
  const send = jest.fn(async (key: string) => {
    expect(store.load('user')?.idempotencyKey).toBe(key);
    throw new TypeError('response lost');
  });
  await expect(runGachaOperation(auth, 'user', request, send, store)).rejects.toThrow('待确认');
  const retry = jest.fn(async () => 'committed');
  await expect(runGachaOperation(auth, 'user', request, retry, store)).resolves.toBe('committed');
  expect(retry).toHaveBeenCalledWith(send.mock.calls[0]![0]);
  expect(store.load('user')).toBeNull();
});

it('rejects overlapping requests and retains the original owner on account change', async () => {
  const values = new Map<string, string>();
  const store = new GachaOperationStore({
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
  });
  let session = { userId: 'user', initialUser: null };
  const auth = { getAuthSession: () => session } as IAuthService;
  const request = { operation: 'exchange', rewardId: 'avenger' } as const;
  let resolveRequest!: (value: string) => void;
  const pending = runGachaOperation(
    auth,
    'user',
    request,
    () =>
      new Promise<string>((resolve) => {
        resolveRequest = resolve;
      }),
    store,
  );
  const secondSend = jest.fn();
  await expect(runGachaOperation(auth, 'user', request, secondSend, store)).rejects.toThrow(
    '正在确认',
  );
  expect(secondSend).not.toHaveBeenCalled();
  session = { userId: 'other-user', initialUser: null };
  resolveRequest('committed');
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(store.load('user')).not.toBeNull();
  expect(store.load('other-user')).toBeNull();
});

it('ends a definite business rejection without blocking a new intent', async () => {
  const values = new Map<string, string>();
  const store = new GachaOperationStore({
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
  });
  const session = { userId: 'user', initialUser: null };
  const auth = { getAuthSession: () => session } as IAuthService;
  const rejection = new CloudflareHttpError({
    status: 400,
    reason: 'INSUFFICIENT_SHARDS',
    body: {},
  });
  await expect(
    runGachaOperation(
      auth,
      'user',
      { operation: 'exchange', rewardId: 'avenger' },
      async () => {
        throw rejection;
      },
      store,
    ),
  ).rejects.toBe(rejection);
  expect(store.load('user')).toBeNull();
});
