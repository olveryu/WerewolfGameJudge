/**
 * Game Context Types
 *
 * Pure type file, used to break stepByStepRunner <-> gameFactory circular dependency.
 * Contains only type/interface, no implementation code.
 */

import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import type { SchemaId } from '@werewolf/game-engine/werewolf/models/roles/spec';
import type { NightPlan } from '@werewolf/game-engine/werewolf/models/roles/spec/plan';
import type { GameTemplate } from '@werewolf/game-engine/werewolf/models/Template';
import type { PlayerMessage, WerewolfState } from '@werewolf/game-engine/werewolf/protocol/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Captured message record (for wire protocol contract tests)
 */
export interface CapturedMessage {
  /** currentStepId when the message was sent */
  stepId: SchemaId | null;
  /** Original PlayerMessage */
  message: PlayerMessage;
}

/**
 * Host Game Context
 *
 * Game context interface used by integration tests.
 * Implementation lives in gameFactory.ts createGame().
 */
export interface GameContext {
  /** Get current WerewolfState */
  getGameState: () => WerewolfState;
  /** Get current revision */
  getRevision: () => number;
  /** Get NightPlan */
  getNightPlan: () => NightPlan;
  /** Send PlayerMessage (simulates player->host intent) */
  sendPlayerMessage: (msg: PlayerMessage) => ActionResult;
  /** Advance to the next night step */
  advanceNight: () => ActionResult;
  /**
   * Advance to the next night step (fail-fast version)
   *
   * This is the **single fail-fast implementation source** for all board integration tests.
   * Implementation lives in gameFactory.ts.
   *
   * Hard requirements:
   * - No custom similar helpers in test files or runners
   * - This function does not automatically send any ack/gate messages
   * - Throws on gate blocks; no automatic handling
   *
   * @param context - Context info (used for error messages)
   * @throws if advanceNight returns success: false
   */
  advanceNightOrThrow: (context: string) => void;
  /** End the night, trigger death settlement */
  endNight: () => { success: boolean; deaths: number[] };
  /** Assert the current step */
  assertStep: (expectedStepId: SchemaId) => void;
  /** Find seat number by role */
  findSeatByRole: (role: RoleId) => number;
  /** Get the role at a seat */
  getRoleAtSeat: (seat: number) => RoleId | null;
  /** Get the template */
  template: GameTemplate;
  /** Get captured messages (for wire protocol contract tests) */
  getCapturedMessages: () => readonly CapturedMessage[];
  /** Clear captured messages */
  clearCapturedMessages: () => void;
}
