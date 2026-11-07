/** reviewAssetStore: one load per asset, honest states, explicit retry, and scope aborts. */

import { createReviewAssetStore } from '../reviewAssetStore';
import type { ReviewImageLoadResult } from '../types';

function deferred() {
  let resolve: (value: ReviewImageLoadResult) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<ReviewImageLoadResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('createReviewAssetStore', () => {
  it('loads an asset once however many readers request it', async () => {
    const store = createReviewAssetStore();
    const load = jest.fn(async () => ({ kind: 'loaded' as const, dataUri: 'data:x' }));
    expect(store.read('a')).toBeNull();

    store.request('a', load);
    store.request('a', load);
    expect(store.read('a')).toEqual({ status: 'loading' });
    await flush();

    expect(load).toHaveBeenCalledTimes(1);
    expect(store.read('a')).toEqual({ status: 'loaded', dataUri: 'data:x' });
  });

  it('keeps an unavailable result as a final state', async () => {
    const store = createReviewAssetStore();
    store.request('a', async () => ({ kind: 'unavailable', message: '画作已过期' }));
    await flush();
    expect(store.read('a')).toEqual({ status: 'unavailable', message: '画作已过期' });
  });

  it('fails a rejected load and reloads it only on retry', async () => {
    const store = createReviewAssetStore();
    const first = deferred();
    store.request('a', () => first.promise);
    first.reject(new Error('network'));
    await flush();
    expect(store.read('a')).toEqual({ status: 'failed' });

    const second = deferred();
    store.retry('a', () => second.promise);
    expect(store.read('a')).toEqual({ status: 'loading' });
    second.resolve({ kind: 'loaded', dataUri: 'data:y' });
    await flush();
    expect(store.read('a')).toEqual({ status: 'loaded', dataUri: 'data:y' });
  });

  it('fails fast on a retry of an asset that has not failed', () => {
    const store = createReviewAssetStore();
    expect(() => store.retry('a', async () => ({ kind: 'unavailable', message: 'x' }))).toThrow(
      '[FAIL-FAST] Review image a retried while not failed',
    );
  });

  it('turns a loaded asset that does not decode into a failure', async () => {
    const store = createReviewAssetStore();
    store.request('a', async () => ({ kind: 'loaded', dataUri: 'data:broken' }));
    await flush();
    store.markDecodeFailed('a');
    expect(store.read('a')).toEqual({ status: 'failed' });
    expect(() => store.markDecodeFailed('a')).toThrow(
      '[FAIL-FAST] Review image a failed to decode while not loaded',
    );
  });

  it('notifies subscribers and bumps the version on every change', async () => {
    const store = createReviewAssetStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.getVersion();

    store.request('a', async () => ({ kind: 'loaded', dataUri: 'data:x' }));
    await flush();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getVersion()).toBe(before + 2);

    unsubscribe();
    store.markDecodeFailed('a');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('aborts and forgets in-flight loads, ignoring their late results', async () => {
    const store = createReviewAssetStore();
    const pending = deferred();
    let signal: AbortSignal | null = null;
    store.request('a', (abortSignal) => {
      signal = abortSignal;
      return pending.promise;
    });
    store.request('b', async () => ({ kind: 'loaded', dataUri: 'data:b' }));
    await flush();

    store.abortPending();
    expect(signal).not.toBeNull();
    expect((signal as AbortSignal | null)?.aborted).toBe(true);
    expect(store.read('a')).toBeNull();
    expect(store.read('b')).toEqual({ status: 'loaded', dataUri: 'data:b' });

    pending.resolve({ kind: 'loaded', dataUri: 'data:late' });
    await flush();
    expect(store.read('a')).toBeNull();
  });
});
