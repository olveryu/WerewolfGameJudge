/**
 * IntentExecutor types — Interface for pluggable ActionIntent handlers
 *
 * Each executor handles one or more ActionIntentTypes, extracted from
 * useActionOrchestrator's big switch. Executors receive the same context
 * the switch closure had access to, bundled into ExecutorContext.
 *
 * Does not own state or lifecycle (those remain in useActionOrchestrator).
 * Does not import services directly.
 */

import type { UseMutationResult } from '@tanstack/react-query';
import type { WerewolfActionInput } from '@werewolf/game-engine/games/werewolf/public';
import type { RoleId } from '@werewolf/game-engine/games/werewolf/public';
import type { ActionSchema } from '@werewolf/game-engine/games/werewolf/public';
import type { ActionResult } from '@werewolf/game-engine/platform/protocol/actionResult';
import type { MutableRefObject } from 'react';

import type { ActionIntent, ActionIntentType } from '@/games/werewolf/room/policy/types';
import type { UseRoomActionDialogsResult } from '@/games/werewolf/room/useRoomActionDialogs';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

type AckResult = ActionResult;

// ─────────────────────────────────────────────────────────────────────────────
// Executor context — bag of dependencies each executor receives
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutorContext {
  // ── Game state (readonly snapshots) ──
  gameState: LocalGameState;
  gameStateRef: MutableRefObject<LocalGameState>;
  currentSchema: ActionSchema | null;
  currentActionRole: RoleId | null;

  // ── Identity ──
  effectiveSeat: number | null;
  effectiveRole: RoleId | null;
  controlledSeat: number | null;
  actorSeatForUi: number | null;

  // ── Magician state ──
  firstSwapSeat: number | null;
  setFirstSwapSeat: (v: number | null) => void;
  setSecondSeat: (v: number | null) => void;

  // ── Multi-select state ──
  multiSelectedSeats: readonly number[];
  setMultiSelectedSeats: (v: readonly number[]) => void;

  // ── Submission helpers ──
  proceedWithAction: (input: WerewolfActionInput) => Promise<boolean>;
  confirmThenAct: (
    targetSeat: number,
    onAccepted: () => Promise<void> | void,
    opts?: { title?: string; message?: string },
  ) => void;

  // ── Server-ack mutations (TanStack — owns isPending lifecycle) ──
  /** reveal-ack roundtrip; mutate() called after user dismisses reveal dialog */
  revealAckMutation: UseMutationResult<AckResult, Error, void>;
  /** wolfRobot hunter-status-viewed roundtrip; controlledSeat is captured by the hook */
  hunterStatusAckMutation: UseMutationResult<void, Error, void>;
  /** groupConfirm-ack roundtrip; mutate() after user confirms group reveal */
  groupConfirmAckMutation: UseMutationResult<AckResult, Error, void>;

  // ── Choose card modal (treasureMaster) ──
  openChooseCardModal?: () => void;

  // ── Dialog layer ──
  actionDialogs: UseRoomActionDialogsResult;

  // ── Lifecycle ──
  /** Ref tracking whether the owning component is still mounted. */
  mountedRef: MutableRefObject<boolean>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Executor interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An IntentExecutor handles one specific ActionIntentType.
 *
 * @param intent - The ActionIntent to process
 * @param ctx - Shared context bag (same data the original switch case had)
 */
export type IntentExecutor = (intent: ActionIntent, ctx: ExecutorContext) => Promise<void> | void;

/** Compile-time exhaustive mapping: every ActionIntentType has exactly one executor. */
export type CompleteExecutorMap = Record<ActionIntentType, IntentExecutor>;
