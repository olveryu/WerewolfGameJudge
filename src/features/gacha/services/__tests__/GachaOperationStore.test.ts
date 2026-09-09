/** Unknown asset delivery survives recreation without changing owner, key or parameters. */
import { GachaOperationStore } from '../GachaOperationStore';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => values.set(key, value),
    remove: (key: string) => values.delete(key),
  };
}

describe('GachaOperationStore', () => {
  const request = { operation: 'draw', drawType: 'normal', count: 1 } as const;

  it('restores the same request after recreation and isolates accounts', () => {
    const storage = createStorage();
    const first = new GachaOperationStore(storage).begin('user-a', request);
    const restored = new GachaOperationStore(storage);
    expect(restored.begin('user-a', request)).toEqual(first);
    expect(restored.load('user-b')).toBeNull();
    expect(() => restored.begin('user-a', { ...request, count: 10 })).toThrow('先恢复原操作');
    restored.complete(first);
    expect(restored.begin('user-a', request).idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('retains expired uncertainty instead of silently creating another debit', () => {
    const store = new GachaOperationStore(createStorage());
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    try {
      const operation = store.begin('user-a', request);
      clock.mockReturnValue(1_000 + 24 * 60 * 60 * 1_000);
      expect(() => store.begin('user-a', request)).toThrow('超过24小时');
      expect(store.load('user-a')).toEqual(operation);
    } finally {
      clock.mockRestore();
    }
  });
});
