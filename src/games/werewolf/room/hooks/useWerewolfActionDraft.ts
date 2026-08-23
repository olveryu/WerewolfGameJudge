/** Step-scoped local selection state that survives reload without submitting an action. */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type WerewolfActionDraft,
  type WerewolfActionDraftRepository,
  type WerewolfActionDraftScope,
  werewolfActionDraftStore,
} from '@/games/werewolf/services/WerewolfActionDraftStore';

const EMPTY_DRAFT: WerewolfActionDraft = {
  firstSwapSeat: null,
  multiSelectedSeats: [],
};

type PersistenceIntent = 'none' | 'write';

interface ScopedActionDraftState {
  readonly scope: WerewolfActionDraftScope | null;
  readonly seatCount: number;
  readonly draft: WerewolfActionDraft;
  readonly persistence: PersistenceIntent;
}

export interface ActiveWerewolfActionDraft {
  readonly scope: WerewolfActionDraftScope;
  readonly seatCount: number;
}

interface UseWerewolfActionDraftResult extends WerewolfActionDraft {
  readonly setFirstSwapSeat: (seat: number | null) => void;
  readonly setMultiSelectedSeats: (seats: readonly number[]) => void;
}

function hasSameScope(
  state: ScopedActionDraftState,
  active: ActiveWerewolfActionDraft | null,
): boolean {
  if (state.scope === null || active === null || state.seatCount !== active.seatCount) return false;
  const current = state.scope;
  const next = active.scope;
  return (
    current.roomId === next.roomId &&
    current.userId === next.userId &&
    current.currentStepId === next.currentStepId &&
    current.currentStepIndex === next.currentStepIndex &&
    current.roleRevealRandomNonce === next.roleRevealRandomNonce &&
    current.actorSeat === next.actorSeat
  );
}

/** Manage editable selections for one exact player, room, round, step, and actor. */
export function useWerewolfActionDraft(
  active: ActiveWerewolfActionDraft | null,
  repository: WerewolfActionDraftRepository = werewolfActionDraftStore,
): UseWerewolfActionDraftResult {
  const stored = useMemo(() => {
    if (active === null) return { kind: 'missing' as const };
    return repository.read(active.scope, active.seatCount);
  }, [active, repository]);
  const loadedDraft = useMemo(
    () => (stored.kind === 'found' ? stored.draft : EMPTY_DRAFT),
    [stored],
  );
  const [state, setState] = useState<ScopedActionDraftState>(() => ({
    scope: active?.scope ?? null,
    seatCount: active?.seatCount ?? 0,
    draft: loadedDraft,
    persistence: 'none',
  }));
  const draft = hasSameScope(state, active) ? state.draft : loadedDraft;

  useEffect(() => {
    if (stored.kind === 'stale' && active !== null) repository.clear(active.scope);
  }, [active, repository, stored.kind]);

  useEffect(() => {
    if (!hasSameScope(state, active) || state.persistence === 'none') return;
    if (active === null) {
      throw new Error('[FAIL-FAST] Cannot persist a Werewolf action draft without an active step');
    }
    repository.write(active.scope, active.seatCount, state.draft);
    setState((current) => (current === state ? { ...current, persistence: 'none' } : current));
  }, [active, repository, state]);

  const updateDraft = useCallback(
    (update: (current: WerewolfActionDraft) => WerewolfActionDraft) => {
      if (active === null) {
        const updated = update(EMPTY_DRAFT);
        if (updated.firstSwapSeat !== null || updated.multiSelectedSeats.length > 0) {
          throw new Error('[FAIL-FAST] Cannot edit a Werewolf action draft without an active step');
        }
        return;
      }
      setState((current) => ({
        scope: active.scope,
        seatCount: active.seatCount,
        draft: update(hasSameScope(current, active) ? current.draft : loadedDraft),
        persistence: 'write',
      }));
    },
    [active, loadedDraft],
  );

  const setFirstSwapSeat = useCallback(
    (firstSwapSeat: number | null) => {
      updateDraft((current) => ({ ...current, firstSwapSeat }));
    },
    [updateDraft],
  );

  const setMultiSelectedSeats = useCallback(
    (multiSelectedSeats: readonly number[]) => {
      updateDraft((current) => ({ ...current, multiSelectedSeats }));
    },
    [updateDraft],
  );

  return {
    firstSwapSeat: draft.firstSwapSeat,
    multiSelectedSeats: draft.multiSelectedSeats,
    setFirstSwapSeat,
    setMultiSelectedSeats,
  };
}
