import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useWerewolfActionDraft } from '@/games/werewolf/room/hooks/useWerewolfActionDraft';
import {
  type WerewolfActionDraftScope,
  WerewolfActionDraftStore,
} from '@/games/werewolf/services/WerewolfActionDraftStore';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => values.set(key, value),
    remove: (key: string) => values.delete(key),
  };
}

const scope: WerewolfActionDraftScope = {
  roomId: 'room-id-2473',
  userId: 'user-9',
  currentStepId: 'magicianSwap',
  currentStepIndex: 2,
  roleRevealRandomNonce: 'round-1',
  actorSeat: 3,
};

const active = { scope, seatCount: 12 };

describe('useWerewolfActionDraft', () => {
  it('restores editable choices after remount without owning command submission', async () => {
    const store = new WerewolfActionDraftStore(createStorage());
    const firstRender = renderHook(() => useWerewolfActionDraft(active, store));

    act(() => {
      firstRender.result.current.setFirstSwapSeat(4);
      firstRender.result.current.setMultiSelectedSeats([1, 7]);
    });
    await waitFor(() => {
      expect(store.read(scope, 12)).toEqual({
        kind: 'found',
        draft: { firstSwapSeat: 4, multiSelectedSeats: [1, 7] },
      });
    });
    firstRender.unmount();

    const restored = renderHook(() => useWerewolfActionDraft(active, store));

    expect(restored.result.current.firstSwapSeat).toBe(4);
    expect(restored.result.current.multiSelectedSeats).toEqual([1, 7]);
  });

  it('does not expose a draft after the active step changes', async () => {
    const store = new WerewolfActionDraftStore(createStorage());
    store.write(scope, 12, { firstSwapSeat: 4, multiSelectedSeats: [1, 7] });
    const changedActive = {
      scope: { ...scope, currentStepId: 'seerCheck' as const, currentStepIndex: 3 },
      seatCount: 12,
    };

    const { result } = renderHook(() => useWerewolfActionDraft(changedActive, store));

    expect(result.current.firstSwapSeat).toBeNull();
    expect(result.current.multiSelectedSeats).toEqual([]);
    await waitFor(() => expect(store.read(changedActive.scope, 12)).toEqual({ kind: 'missing' }));
  });

  it('allows cleanup but rejects a new selection without an active step', () => {
    const store = new WerewolfActionDraftStore(createStorage());
    const { result } = renderHook(() => useWerewolfActionDraft(null, store));

    expect(() => result.current.setFirstSwapSeat(null)).not.toThrow();
    expect(() => result.current.setMultiSelectedSeats([])).not.toThrow();
    expect(() => result.current.setFirstSwapSeat(4)).toThrow('without an active step');
  });
});
