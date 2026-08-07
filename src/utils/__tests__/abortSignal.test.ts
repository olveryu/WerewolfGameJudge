/** Portable AbortSignal composition lifecycle tests. */

import { composeAbortSignals } from '../abortSignal';

const nativeAbortSignalAny = AbortSignal.any;

describe('composeAbortSignals fallback', () => {
  beforeEach(() => {
    Object.defineProperty(AbortSignal, 'any', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    Object.defineProperty(AbortSignal, 'any', {
      configurable: true,
      writable: true,
      value: nativeAbortSignalAny,
    });
    jest.restoreAllMocks();
  });

  it('propagates the first abort reason and removes every source listener', () => {
    const first = new AbortController();
    const second = new AbortController();
    const firstRemoveListener = jest.spyOn(first.signal, 'removeEventListener');
    const secondRemoveListener = jest.spyOn(second.signal, 'removeEventListener');
    const composition = composeAbortSignals([first.signal, second.signal]);
    const reason = new DOMException('Session ended', 'AbortError');

    second.abort(reason);

    expect(composition.signal.aborted).toBe(true);
    expect(composition.signal.reason).toBe(reason);
    expect(firstRemoveListener).toHaveBeenCalledTimes(1);
    expect(secondRemoveListener).toHaveBeenCalledTimes(1);
  });

  it('removes every source listener when the operation settles first', () => {
    const first = new AbortController();
    const second = new AbortController();
    const firstRemoveListener = jest.spyOn(first.signal, 'removeEventListener');
    const secondRemoveListener = jest.spyOn(second.signal, 'removeEventListener');
    const composition = composeAbortSignals([first.signal, second.signal]);

    composition.dispose();
    first.abort();

    expect(composition.signal.aborted).toBe(false);
    expect(firstRemoveListener).toHaveBeenCalledTimes(1);
    expect(secondRemoveListener).toHaveBeenCalledTimes(1);
  });

  it('cleans earlier listeners when a later source is already aborted', () => {
    const active = new AbortController();
    const aborted = new AbortController();
    const activeRemoveListener = jest.spyOn(active.signal, 'removeEventListener');
    const reason = new DOMException('Already ended', 'AbortError');
    aborted.abort(reason);

    const composition = composeAbortSignals([active.signal, aborted.signal]);

    expect(composition.signal.aborted).toBe(true);
    expect(composition.signal.reason).toBe(reason);
    expect(activeRemoveListener).toHaveBeenCalledTimes(1);
  });
});
