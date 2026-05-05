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

import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionSchema } from '@werewolf/game-engine/models/roles/spec';
import type { MutableRefObject } from 'react';

import type { ActionIntent, ActionIntentType } from '@/screens/RoomScreen/policy/types';
import type { UseRoomActionDialogsResult } from '@/screens/RoomScreen/useRoomActionDialogs';
import type { LocalGameState } from '@/types/GameStateTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Executor context — bag of dependencies each executor receives
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutorContext {
  // ── Game state (readonly snapshots) ──
  gameState: LocalGameState | null;
  gameStateRef: MutableRefObject<LocalGameState | null>;
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
  proceedWithAction: (targetSeat: number | null, extra?: unknown) => Promise<boolean>;
  confirmThenAct: (
    targetSeat: number,
    onAccepted: () => Promise<void> | void,
    opts?: { title?: string; message?: string },
  ) => void;

  // ── Action callbacks ──
  submitRevealAck: () => Promise<{ success: boolean; reason?: string }>;
  sendWolfRobotHunterStatusViewed: (seat: number) => Promise<void>;
  submitGroupConfirmAck: () => void;

  // ── Pending state ──
  setPendingRevealDialog: (v: boolean) => void;
  pendingHunterStatusViewed: boolean;
  setPendingHunterStatusViewed: (v: boolean) => void;

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

/**
 * Type-safe mapping from ActionIntentType to its executor function.
 * Internal: registry is Partial (filled incrementally at module init).
 */
export type ExecutorMap = Partial<Record<ActionIntentType, IntentExecutor>>;

/**
 * Compile-time exhaustive check: every ActionIntentType must have an executor.
 *
 * If a new variant is added to ActionIntentType without registering an executor
 * in executors/index.ts, the `satisfies` below will produce a type error.
 * Usage: see executors/index.ts.
 */
export type CompleteExecutorMap = Record<ActionIntentType, IntentExecutor>;
