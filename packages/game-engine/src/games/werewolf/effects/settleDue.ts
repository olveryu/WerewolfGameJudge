/**
 * The scheduled settle effect for one deadline a Werewolf handler arms.
 * Emitted at the same site that writes the deadline event, so an armed
 * deadline and its settle.due are one decision; the payload pins the
 * arming (game, phase, deadline) for the Worker's staleness gate.
 */

import { WEREWOLF_GAME_TYPE } from '../../../platform/protocol/gameTypes';
import { buildSettleDueEffect } from '../../../platform/room/phaseDeadline';
import type { GameState } from '../domain/protocol/types';
import type { WerewolfDeadlinePhase, WerewolfSettleDueEffect } from './types';

export function werewolfSettleDueEffect(
  state: GameState,
  phase: WerewolfDeadlinePhase,
  deadlineAt: number,
): WerewolfSettleDueEffect {
  return buildSettleDueEffect(WEREWOLF_GAME_TYPE, {
    gameSequence: state.gameSequence,
    phase,
    deadlineAt,
  });
}
