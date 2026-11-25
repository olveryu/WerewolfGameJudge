import { GameStatus } from '../domain/models/GameStatus';
import type { GameState } from '../domain/protocol/types';
import { resolveDeathEffects } from './deathEffects';
import { getActiveRoleIds } from './identity';
import { getWerewolfRoleDefinition } from './nightPlan';
import { collectWerewolfDeathEffects, createWerewolfStepRuntime } from './nightRuntime';

/** One card in a player's hand on the day after the night, visible to that player alone. */
export interface WerewolfPersonalDaytimeView {
  readonly key: string;
  readonly label: string;
  readonly prompt: string;
  readonly title: string;
  readonly text: string;
}

/**
 * The cards `seat` may open once the host has published the night's deaths. A holder of a
 * declaring role always gets the card, so having it says nothing about what happened.
 */
export function getWerewolfPersonalDaytimeViews(
  state: GameState,
  seat: number | null,
): readonly WerewolfPersonalDaytimeView[] {
  const night = state.nightState;
  if (
    seat === null ||
    night === null ||
    state.lastNightInfoConfirmed !== true ||
    (state.status !== GameStatus.Day && state.status !== GameStatus.Ended)
  ) {
    return [];
  }
  const identity = night.roles.identities[seat];
  if (identity === undefined) return [];
  const declaringRoles = getActiveRoleIds(identity).flatMap((roleId) => {
    const declaration = getWerewolfRoleDefinition(roleId).personalDaytimeView;
    return declaration === undefined ? [] : [{ roleId, declaration }];
  });
  if (declaringRoles.length === 0) return [];
  const runtime = createWerewolfStepRuntime(null);
  const context = runtime.createContext(state, night.facts, null, { bySeat: {} });
  const resolution = resolveDeathEffects(collectWerewolfDeathEffects(context));
  return declaringRoles.map(({ roleId, declaration }) => ({
    key: roleId,
    label: declaration.label,
    prompt: declaration.prompt,
    title: declaration.title,
    text: declaration.content(seat, resolution),
  }));
}
