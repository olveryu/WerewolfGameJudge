/**
 * Sheriff-election room orchestrator.
 *
 * Combines the pure authoritative-state projection with command callbacks and
 * one local submission mutex. It never predicts or mutates election state.
 */

import { useCallback, useMemo, useState } from 'react';

import {
  createSheriffElectionViewModel,
  type SheriffElectionViewModel,
} from '@/games/werewolf/room/sheriffElectionViewModel';
import type { WerewolfCommandDispatchOutcome } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

export type SheriffElectionPendingAction =
  | { readonly kind: 'register' }
  | { readonly kind: 'cancelRegistration' }
  | { readonly kind: 'withdraw' }
  | { readonly kind: 'vote'; readonly targetSeat: number | null }
  | { readonly kind: 'advance' };

export interface SheriffElectionPanelModel {
  readonly view: SheriffElectionViewModel;
  readonly pendingAction: SheriffElectionPendingAction | null;
  readonly isInteractionDisabled: boolean;
  readonly register: () => Promise<void>;
  readonly cancelRegistration: () => Promise<void>;
  readonly withdraw: () => Promise<void>;
  readonly vote: (targetSeat: number | null) => Promise<void>;
  readonly advance: () => Promise<void>;
}

interface UseSheriffElectionInput {
  readonly gameState: LocalGameState;
  readonly effectiveSeat: number | null;
  readonly isHost: boolean;
  readonly isAudioPlaying: boolean;
  readonly registerSheriffCandidate: () => Promise<WerewolfCommandDispatchOutcome>;
  readonly cancelSheriffRegistration: () => Promise<WerewolfCommandDispatchOutcome>;
  readonly withdrawSheriffCandidate: () => Promise<WerewolfCommandDispatchOutcome>;
  readonly castSheriffVote: (targetSeat: number | null) => Promise<WerewolfCommandDispatchOutcome>;
  readonly advanceSheriffElection: () => Promise<WerewolfCommandDispatchOutcome>;
}

/** Build the state-driven sheriff-election panel and command callbacks. */
export function useSheriffElection(
  input: UseSheriffElectionInput,
): SheriffElectionPanelModel | null {
  const {
    advanceSheriffElection,
    cancelSheriffRegistration,
    castSheriffVote,
    effectiveSeat,
    gameState,
    isAudioPlaying,
    isHost,
    registerSheriffCandidate,
    withdrawSheriffCandidate,
  } = input;
  const [pendingAction, setPendingAction] = useState<SheriffElectionPendingAction | null>(null);
  const view = useMemo(
    () =>
      createSheriffElectionViewModel({
        gameState,
        effectiveSeat,
        isHost,
      }),
    [effectiveSeat, gameState, isHost],
  );

  const executeCommand = useCallback(
    async (
      action: SheriffElectionPendingAction,
      label: string,
      command: () => Promise<WerewolfCommandDispatchOutcome>,
    ): Promise<void> => {
      setPendingAction(action);
      try {
        await command();
      } catch (error) {
        handleError(error, {
          label,
          logger: roomScreenLog,
          alertMessage: `${label}失败，请重试`,
        });
      } finally {
        setPendingAction(null);
      }
    },
    [],
  );

  const register = useCallback(
    () => executeCommand({ kind: 'register' }, '报名上警', registerSheriffCandidate),
    [executeCommand, registerSheriffCandidate],
  );
  const cancelRegistration = useCallback(
    () => executeCommand({ kind: 'cancelRegistration' }, '取消报名', cancelSheriffRegistration),
    [cancelSheriffRegistration, executeCommand],
  );
  const withdraw = useCallback(
    () => executeCommand({ kind: 'withdraw' }, '退水', withdrawSheriffCandidate),
    [executeCommand, withdrawSheriffCandidate],
  );
  const vote = useCallback(
    (targetSeat: number | null) =>
      executeCommand({ kind: 'vote', targetSeat }, '竞选投票', () => castSheriffVote(targetSeat)),
    [castSheriffVote, executeCommand],
  );
  const advance = useCallback(
    () => executeCommand({ kind: 'advance' }, '推进竞选', advanceSheriffElection),
    [advanceSheriffElection, executeCommand],
  );

  return useMemo(
    () =>
      view === null
        ? null
        : {
            view,
            pendingAction,
            isInteractionDisabled: isAudioPlaying,
            register,
            cancelRegistration,
            withdraw,
            vote,
            advance,
          },
    [advance, cancelRegistration, isAudioPlaying, pendingAction, register, view, vote, withdraw],
  );
}
