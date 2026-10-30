/**
 * Sheriff-election room orchestrator.
 *
 * Combines the pure authoritative-state projection with command callbacks and
 * one local submission mutex. It never predicts or mutates election state.
 */

import type {
  GameState,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { useCallback, useMemo, useState } from 'react';

import { showConfirmAlert, showDestructiveAlert } from '@/utils/alertPresets';

import {
  createSheriffElectionViewModel,
  type SheriffElectionViewModel,
} from './sheriffElectionViewModel';

export type SheriffElectionPendingAction =
  | { readonly kind: 'register' }
  | { readonly kind: 'cancelRegistration' }
  | { readonly kind: 'withdraw' }
  | { readonly kind: 'vote'; readonly targetSeat: number | null }
  | { readonly kind: 'advance' }
  | { readonly kind: 'endBySelfDestruct' };

export interface SheriffElectionPanelModel {
  readonly view: SheriffElectionViewModel;
  readonly pendingAction: SheriffElectionPendingAction | null;
  readonly register: () => Promise<void>;
  readonly cancelRegistration: () => Promise<void>;
  readonly withdraw: () => Promise<void>;
  readonly vote: (targetSeat: number | null) => Promise<void>;
  readonly advance: () => Promise<void>;
  /** Host tap on the advance action: closing registration asks first. */
  readonly requestAdvance: () => void;
  readonly requestEndBySelfDestruct: () => void;
}

interface UseSheriffElectionInput {
  readonly gameState: GameState;
  readonly effectiveSeat: number | null;
  readonly isHost: boolean;
  /**
   * The room's single-flight submit, bound to the effective seat by the
   * caller; failures are presented by the submission itself.
   */
  readonly submit: (label: string, command: WerewolfPublicCommand) => Promise<boolean>;
}

export function useSheriffElection(
  input: UseSheriffElectionInput,
): SheriffElectionPanelModel | null {
  const { effectiveSeat, gameState, isHost, submit } = input;
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
      command: WerewolfPublicCommand,
    ): Promise<void> => {
      setPendingAction(action);
      try {
        await submit(label, command);
      } finally {
        setPendingAction(null);
      }
    },
    [submit],
  );

  const register = useCallback(
    () => executeCommand({ kind: 'register' }, '报名上警', { type: 'werewolf.sheriff.register' }),
    [executeCommand],
  );
  const cancelRegistration = useCallback(
    () =>
      executeCommand({ kind: 'cancelRegistration' }, '取消报名', {
        type: 'werewolf.sheriff.cancelRegistration',
      }),
    [executeCommand],
  );
  const withdraw = useCallback(
    () => executeCommand({ kind: 'withdraw' }, '退水', { type: 'werewolf.sheriff.withdraw' }),
    [executeCommand],
  );
  const vote = useCallback(
    (targetSeat: number | null) =>
      executeCommand({ kind: 'vote', targetSeat }, '竞选投票', {
        type: 'werewolf.sheriff.vote',
        targetSeat,
      }),
    [executeCommand],
  );
  const advance = useCallback(
    () => executeCommand({ kind: 'advance' }, '推进竞选', { type: 'werewolf.sheriff.advance' }),
    [executeCommand],
  );
  const requestAdvance = useCallback(() => {
    // Closing registration is irreversible and registration is still
    // secret at that point, so the confirm copy names no counts or
    // seats — it only states the consequence. Later phases advance
    // directly: ending a speech or confirming the candidate list is
    // the Host's pacing call at the table.
    if (view !== null && view.phase === 'registration') {
      showConfirmAlert('结束报名？', '结束后，未报名的玩家不能再参选。', advance);
      return;
    }
    void advance();
  }, [advance, view]);
  const endBySelfDestruct = useCallback(
    () =>
      executeCommand({ kind: 'endBySelfDestruct' }, '自爆结束竞选', {
        type: 'werewolf.sheriff.endBySelfDestruct',
      }),
    [executeCommand],
  );
  const requestEndBySelfDestruct = useCallback(() => {
    showDestructiveAlert(
      '确认结束警长竞选？',
      '确认后，本次警长竞选将直接结束且不产生警长。单爆、双爆，以及单爆后是否在下一天退水并直接投票，请按本局规则线下决定；应用不判断或记录自爆次数。',
      '确认结束',
      endBySelfDestruct,
    );
  }, [endBySelfDestruct]);

  return useMemo(
    () =>
      view === null
        ? null
        : {
            view,
            pendingAction,
            register,
            cancelRegistration,
            withdraw,
            vote,
            advance,
            requestAdvance,
            requestEndBySelfDestruct,
          },
    [
      advance,
      cancelRegistration,
      pendingAction,
      register,
      requestAdvance,
      requestEndBySelfDestruct,
      view,
      vote,
      withdraw,
    ],
  );
}
