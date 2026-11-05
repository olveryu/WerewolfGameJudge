/**
 * Werewolf phase expiry: the one reading of "which deadline is armed
 * right now" and the expiry guard that settles it.
 *
 * Two carriers arm a deadline, each only inside the phase that owns it:
 * the night step's `stepDeadline` (wolf-vote settle countdown, vacant
 * bottom-card auto-skip) and a sheriff voting round's `deadline`
 * (settle countdown). Each arming site emits the matching
 * `werewolf.settle.due` (effects/settleDue.ts). Settlement is the inline
 * progression pass that every other progression trigger already runs;
 * this module only gates it on the shared phase-expiry chassis
 * (`platform/room/phaseDeadline`).
 */

import { type CommandContext, commit, type Decision, reject } from '../../../platform/engine';
import {
  guardPhaseExpiry,
  type PhaseExpiryActorChannel,
} from '../../../platform/room/phaseDeadline';
import type { WerewolfDeadlinePhase, WerewolfEffect } from '../effects/types';
import { runInlineProgression } from './inlineProgression';
import { GameStatus } from './models/GameStatus';
import type { GameState } from './protocol/types';
import type { StateAction } from './reducer/types';

/** The current phase has no deadline carrier (not a night step, not a sheriff voting round). */
export const REASON_PHASE_NOT_EXPIRABLE = 'phase_not_expirable' as const;
/** The carrier exists but no deadline is armed, or it has not been reached. */
export const REASON_DEADLINE_NOT_REACHED = 'deadline_not_reached' as const;

/** The deadline currently armed on the state, if any. */
export interface ArmedDeadline {
  readonly phase: WerewolfDeadlinePhase;
  readonly deadlineAt: number;
}

/** Whether the state is in a phase that can carry a deadline at all. */
function isExpirablePhase(state: GameState): boolean {
  if (state.status === GameStatus.Ongoing) return state.nightStep?.kind === 'inStep';
  if (state.status === GameStatus.Day) {
    const phase = state.sheriffElection?.phase;
    return phase === 'firstVote' || phase === 'runoffVote';
  }
  return false;
}

/** Reads the armed deadline from the state's current carrier; null while none is armed. */
export function readArmedDeadline(state: GameState): ArmedDeadline | null {
  if (state.status === GameStatus.Ongoing && state.nightStep?.kind === 'inStep') {
    const deadlineAt = state.nightStep.stepDeadline;
    return deadlineAt === undefined ? null : { phase: state.nightStep.stepId, deadlineAt };
  }
  if (state.status === GameStatus.Day) {
    const election = state.sheriffElection;
    if (election?.phase === 'firstVote' || election?.phase === 'runoffVote') {
      const deadlineAt = election.deadline;
      return deadlineAt === undefined ? null : { phase: election.phase, deadlineAt };
    }
  }
  return null;
}

/**
 * Settles the armed deadline once it is reached, via the internal
 * settleExpired command only (the scheduled `werewolf.settle.due`
 * delivery; system channel — D3, 2026-11-05, the public expire
 * command was deleted). Dispatch is the ordinary inline progression
 * pass from the current state.
 *
 * The host retry (`werewolf.phase.retrySettle`) runs the same guard
 * sequence and the same dispatch, only on the uncontrolled-user
 * channel: the decide case gates the host first, then calls this
 * with `actorChannel: 'uncontrolledUser'`. It is not an expire send
 * — the retry re-drives the current phase's settle, never a
 * client-sent expiry.
 */
export function decidePhaseExpiry(
  state: GameState,
  context: CommandContext,
  actorChannel: PhaseExpiryActorChannel = 'system',
): Decision<StateAction, WerewolfEffect> {
  const armed = readArmedDeadline(state);
  return guardPhaseExpiry<StateAction, WerewolfEffect>(context, {
    phaseRejection: isExpirablePhase(state) ? null : reject(REASON_PHASE_NOT_EXPIRABLE),
    actorChannel,
    deadlineAt: armed === null ? null : armed.deadlineAt,
    notExpiredReason: REASON_DEADLINE_NOT_REACHED,
    dispatch: () => {
      const progression = runInlineProgression(state, state.hostUserId, context);
      return commit<StateAction, WerewolfEffect>({
        events: progression.actions,
        effects: progression.effects,
      });
    },
  });
}
