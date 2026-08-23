import {
  type WerewolfActionDraftScope,
  WerewolfActionDraftStore,
} from '@/games/werewolf/services/WerewolfActionDraftStore';

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => values.set(key, value),
    remove: (key: string) => values.delete(key),
  };
}

function createScope(overrides: Partial<WerewolfActionDraftScope> = {}): WerewolfActionDraftScope {
  return {
    roomId: 'room-id-2473',
    userId: 'user-9',
    currentStepId: 'magicianSwap',
    currentStepIndex: 2,
    roleRevealRandomNonce: 'round-1',
    actorSeat: 3,
    ...overrides,
  };
}

describe('WerewolfActionDraftStore', () => {
  it('round-trips editable selections for one exact step scope', () => {
    const storage = createStorage();
    const store = new WerewolfActionDraftStore(storage);
    const scope = createScope();

    store.write(scope, 12, { firstSwapSeat: 4, multiSelectedSeats: [1, 7] });

    expect(store.read(scope, 12)).toEqual({
      kind: 'found',
      draft: { firstSwapSeat: 4, multiSelectedSeats: [1, 7] },
    });
  });

  it.each([
    ['step ID', { currentStepId: 'seerCheck' as const }],
    ['step index', { currentStepIndex: 3 }],
    ['round', { roleRevealRandomNonce: 'round-2' }],
    ['actor', { actorSeat: 4 }],
  ])('rejects a draft from a changed %s as stale', (_label, changedScope) => {
    const storage = createStorage();
    const store = new WerewolfActionDraftStore(storage);
    store.write(createScope(), 12, { firstSwapSeat: 4, multiSelectedSeats: [] });

    expect(store.read(createScope(changedScope), 12)).toEqual({ kind: 'stale' });
  });

  it('removes storage when the editable selection becomes empty', () => {
    const storage = createStorage();
    const store = new WerewolfActionDraftStore(storage);
    const scope = createScope();
    store.write(scope, 12, { firstSwapSeat: 4, multiSelectedSeats: [] });

    store.write(scope, 12, { firstSwapSeat: null, multiSelectedSeats: [] });

    expect(store.read(scope, 12)).toEqual({ kind: 'missing' });
  });

  it('rejects persisted seats outside the current board', () => {
    const storage = createStorage();
    const store = new WerewolfActionDraftStore(storage);
    store.write(createScope(), 12, { firstSwapSeat: 11, multiSelectedSeats: [] });

    expect(() => store.read(createScope(), 8)).toThrow('within the current board');
  });

  it('treats a valid draft from a larger old board and different actor as stale', () => {
    const storage = createStorage();
    const store = new WerewolfActionDraftStore(storage);
    store.write(createScope({ actorSeat: 11 }), 12, {
      firstSwapSeat: 10,
      multiSelectedSeats: [9],
    });

    expect(store.read(createScope({ actorSeat: 3 }), 8)).toEqual({ kind: 'stale' });
  });
});
