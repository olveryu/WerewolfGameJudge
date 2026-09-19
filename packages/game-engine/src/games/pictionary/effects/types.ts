/** Immutable completion roster emitted when all relay work enters the gallery. */

import type { GameEffect } from '../../../platform/engine';

export interface PictionaryEffect extends GameEffect {
  readonly type: 'pictionary.round.completed';
  readonly payload: {
    readonly roundId: string;
    readonly completedAt: number;
    readonly participantUserIds: readonly string[];
  };
}
