/**
 * Reveal payload builder.
 *
 * Maps resolver output to the `APPLY_RESOLVER_RESULT` action payload
 * using the schema's `revealKind` as dispatch key.
 * Adding a new RevealKind forces a compile error in REVEAL_HANDLERS.
 */

import { type RevealKind, type RoleId, type SchemaId, SCHEMAS } from '../models';
import { getRoleSpec } from '../models/roles/spec/specs';
import type { ApplyResolverResultAction } from '../reducer/types';
import type { ResolverSuccess } from '../resolvers/types';

// ---------------------------------------------------------------------------
// Registry-derived gate trigger roles
// ---------------------------------------------------------------------------

/**
 * Extract gateTriggersOnRoles from the first learn effect in wolfRobot's abilities.
 * The role registry type-checks every referenced role ID.
 */
function deriveGateTriggerRoles(): readonly RoleId[] {
  const spec = getRoleSpec('wolfRobot');
  for (const ability of spec.abilities) {
    if (ability.type !== 'active') continue;
    const active = ability;
    for (const effect of active.effects) {
      if (effect.kind === 'learn') {
        return effect.gateTriggersOnRoles ?? [];
      }
    }
  }
  throw new Error('[revealPayload] wolfRobot must declare a learn effect');
}

export const WOLF_ROBOT_GATE_ROLES = deriveGateTriggerRoles();

// ---------------------------------------------------------------------------
// Type aliases
// ---------------------------------------------------------------------------

/** RevealKind keys that use checkResult (seer family) */
type CheckResultRevealKey = 'seerReveal' | 'mirrorSeerReveal' | 'drunkSeerReveal';

/** RevealKind keys that use identityResult (identity-check family) */
type IdentityResultRevealKey =
  | 'psychicReveal'
  | 'gargoyleReveal'
  | 'pureWhiteReveal'
  | 'wolfWitchReveal';

// ---------------------------------------------------------------------------
// Generic reveal handler factories (DRY)
// ---------------------------------------------------------------------------

function makeCheckResultRevealHandler(
  key: CheckResultRevealKey,
): (
  result: ResolverSuccess,
  targetSeat: number,
) => Pick<ApplyResolverResultAction['payload'], CheckResultRevealKey> {
  return (result, targetSeat) => {
    if (result.reveal?.kind !== 'factionCheck') {
      throw new Error(`[FAIL-FAST] ${key} requires a factionCheck resolver reveal`);
    }
    return { [key]: { targetSeat, result: result.reveal.checkResult } };
  };
}

function makeIdentityResultRevealHandler(
  key: IdentityResultRevealKey,
): (
  result: ResolverSuccess,
  targetSeat: number,
) => Pick<ApplyResolverResultAction['payload'], IdentityResultRevealKey> {
  return (result, targetSeat) => {
    if (result.reveal?.kind !== 'identityCheck') {
      throw new Error(`[FAIL-FAST] ${key} requires an identityCheck resolver reveal`);
    }
    return { [key]: { targetSeat, result: result.reveal.roleId } };
  };
}

/**
 * Handle WolfRobot reveal
 */
function handleWolfRobotReveal(
  result: ResolverSuccess,
  targetSeat: number,
): Pick<
  ApplyResolverResultAction['payload'],
  'wolfRobotReveal' | 'wolfRobotHunterStatusViewed' | 'wolfRobotContext'
> {
  if (result.reveal?.kind !== 'wolfRobotLearn') {
    throw new Error('[FAIL-FAST] wolfRobot reveal requires a wolfRobotLearn resolver reveal');
  }

  const { learnedRoleId, canShootAsHunter } = result.reveal;
  const hasShootStatus = WOLF_ROBOT_GATE_ROLES.includes(learnedRoleId);
  if (hasShootStatus && canShootAsHunter === undefined) {
    throw new Error(
      '[FAIL-FAST] wolfRobotLearn handler must resolve shoot status for a gate-triggering role',
    );
  }
  if (!hasShootStatus && canShootAsHunter !== undefined) {
    throw new Error('[FAIL-FAST] wolfRobotLearn produced shoot status for a non-gate role');
  }

  const payload: Pick<
    ApplyResolverResultAction['payload'],
    'wolfRobotReveal' | 'wolfRobotHunterStatusViewed' | 'wolfRobotContext'
  > = {
    wolfRobotReveal: {
      targetSeat,
      result: learnedRoleId,
      learnedRoleId,
      canShootAsHunter,
    },
    wolfRobotContext: {
      learnedSeat: targetSeat,
      disguisedRole: learnedRoleId,
    },
    ...(hasShootStatus ? { wolfRobotHunterStatusViewed: false } : {}),
  };

  return payload;
}

// ---------------------------------------------------------------------------
// Reveal handler registry — keyed by RevealKind (SSOT)
// ---------------------------------------------------------------------------

type RevealHandler = (
  result: ResolverSuccess,
  targetSeat: number,
) => Partial<ApplyResolverResultAction['payload']>;

const REVEAL_HANDLERS: Record<RevealKind, RevealHandler> = {
  seer: makeCheckResultRevealHandler('seerReveal'),
  mirrorSeer: makeCheckResultRevealHandler('mirrorSeerReveal'),
  drunkSeer: makeCheckResultRevealHandler('drunkSeerReveal'),
  psychic: makeIdentityResultRevealHandler('psychicReveal'),
  gargoyle: makeIdentityResultRevealHandler('gargoyleReveal'),
  pureWhite: makeIdentityResultRevealHandler('pureWhiteReveal'),
  wolfWitch: makeIdentityResultRevealHandler('wolfWitchReveal'),
  wolfRobot: handleWolfRobotReveal,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build ApplyResolverResultAction payload from resolver result
 */
export function buildRevealPayload(
  result: ResolverSuccess,
  schemaId: SchemaId,
  targetSeat: number,
): Omit<ApplyResolverResultAction['payload'], 'sourceSeat'> {
  const payload: Omit<ApplyResolverResultAction['payload'], 'sourceSeat'> = {
    updates: result.updates,
  };

  // Look up the corresponding reveal via schema.ui.revealKind (schema is single source of truth)
  const revealKind = SCHEMAS[schemaId].ui?.revealKind;
  if (!revealKind) {
    if (result.reveal) {
      throw new Error(
        `[FAIL-FAST] Schema ${schemaId} cannot consume resolver reveal ${result.reveal.kind}`,
      );
    }
    return payload;
  }

  Object.assign(payload, REVEAL_HANDLERS[revealKind](result, targetSeat));

  return payload;
}
