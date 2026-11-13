/** Immutable completion roster emitted when all relay work enters the gallery. */

import type { GameEffect } from '../../../platform/engine';
import type { GameCompletionPayload } from '../../../platform/engine/completionEffect';
import type { PictionaryCompletionPayload } from '../publicStats';

export interface PictionaryGameCompletedEffect extends GameEffect {
  readonly type: 'pictionary.game.completed';
  readonly payload: GameCompletionPayload | PictionaryCompletionPayload;
}

/**
 * Scheduled settle effect for one armed stage deadline, emitted
 * exactly once when the deadline is written. The Worker outbox
 * delivers it at `deadlineAt` (alarm-scheduled), and the handler
 * settles through the internal settle command unless the phase has
 * already moved on. The payload pins the exact arming (round,
 * phase revision, step, deadline) so a late or replayed delivery
 * can never settle a newer phase. The internal settle command
 * itself carries no pin at all.
 */
export interface PictionarySettleDueEffect extends GameEffect {
  readonly type: 'pictionary.settle.due';
  readonly payload: {
    readonly roundId: string;
    readonly phaseRevision: number;
    readonly stepIndex: number;
    readonly deadlineAt: number;
  };
}

export type PictionaryEffect = PictionaryGameCompletedEffect | PictionarySettleDueEffect;
