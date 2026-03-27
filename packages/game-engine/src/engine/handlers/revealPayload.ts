/**
 * Reveal payload builder.
 *
 * Maps resolver output to the `APPLY_RESOLVER_RESULT` action payload
 * using the schema's `revealKind` as dispatch key.
 * Adding a new RevealKind forces a compile error in REVEAL_HANDLERS.
 */

import { type RevealKind, type SchemaId, SCHEMAS } from '../../models';
import type { ActiveAbility, LearnEffect } from '../../models/roles/spec/v2/ability.types';
import type { RoleSpecV2 } from '../../models/roles/spec/v2/roleSpec.types';
import { ROLE_SPECS_V2 } from '../../models/roles/spec/v2/specs';
import type { ResolverResult } from '../../resolvers/types';
import type { ApplyResolverResultAction } from '../reducer/types';

// ---------------------------------------------------------------------------
// V2-derived gate trigger roles (replaces hardcoded 'hunter' check)
// ---------------------------------------------------------------------------

/**
 * Extract gateTriggersOnRoles from the first learn effect in wolfRobot's abilities.
 * Returns empty array if not found (no gate triggered).
 */
function deriveGateTriggerRoles(): readonly string[] {
  const spec = ROLE_SPECS_V2.wolfRobot as RoleSpecV2;
  for (const ability of spec.abilities) {
    if (ability.type !== 'active') continue;
    const active = ability as ActiveAbility;
    for (const effect of active.effects) {
      if (effect.kind === 'learn') {
        return (effect as LearnEffect).gateTriggersOnRoles ?? [];
      }
    }
  }
  return [];
}

const WOLF_ROBOT_GATE_ROLES = deriveGateTriggerRoles();

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
  result: ResolverResult,
  targetSeat: number,
) => Pick<ApplyResolverResultAction['payload'], CheckResultRevealKey> {
  return (result, targetSeat) => {
    if (result.result?.checkResult) {
      return { [key]: { targetSeat, result: result.result.checkResult } } as Pick<
        ApplyResolverResultAction['payload'],
        CheckResultRevealKey
      >;
    }
    return {} as Pick<ApplyResolverResultAction['payload'], CheckResultRevealKey>;
  };
}

function makeIdentityResultRevealHandler(
  key: IdentityResultRevealKey,
): (
  result: ResolverResult,
  targetSeat: number,
) => Pick<ApplyResolverResultAction['payload'], IdentityResultRevealKey> {
  return (result, targetSeat) => {
    if (result.result?.identityResult) {
      return { [key]: { targetSeat, result: result.result.identityResult } } as Pick<
        ApplyResolverResultAction['payload'],
        IdentityResultRevealKey
      >;
    }
    return {} as Pick<ApplyResolverResultAction['payload'], IdentityResultRevealKey>;
  };
}

/**
 * 处理 WolfRobot reveal
 */
function handleWolfRobotReveal(
  result: ResolverResult,
  targetSeat: number,
): Pick<
  ApplyResolverResultAction['payload'],
  'wolfRobotReveal' | 'wolfRobotHunterStatusViewed' | 'wolfRobotContext'
> {
  if (!result.result?.identityResult) {
    return {};
  }

  const learnedRoleId = result.result.learnedRoleId;
  // FAIL-FAST: learnedRoleId is REQUIRED when wolfRobotReveal is set
  if (!learnedRoleId) {
    throw new Error(
      '[FAIL-FAST] wolfRobotLearn resolver must return learnedRoleId when identityResult is set',
    );
  }

  const payload: Pick<
    ApplyResolverResultAction['payload'],
    'wolfRobotReveal' | 'wolfRobotHunterStatusViewed' | 'wolfRobotContext'
  > = {
    wolfRobotReveal: {
      targetSeat,
      result: result.result.identityResult,
      learnedRoleId,
      canShootAsHunter: result.result.canShootAsHunter,
    },
  };

  // Gate: if learned a gate-triggering role, set gate to false (requires viewing before advancing)
  if (WOLF_ROBOT_GATE_ROLES.includes(learnedRoleId)) {
    payload.wolfRobotHunterStatusViewed = false;
  }

  // Write wolfRobotContext for disguise during subsequent checks
  if (result.result.learnTarget !== undefined && learnedRoleId) {
    payload.wolfRobotContext = {
      learnedSeat: result.result.learnTarget,
      disguisedRole: learnedRoleId,
    };
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Reveal handler registry — keyed by RevealKind (SSOT)
// ---------------------------------------------------------------------------

type RevealHandler = (
  result: ResolverResult,
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
 * 从 resolver result 构建 ApplyResolverResultAction payload
 */
export function buildRevealPayload(
  result: ResolverResult,
  schemaId: SchemaId,
  targetSeat: number,
): ApplyResolverResultAction['payload'] {
  const payload: ApplyResolverResultAction['payload'] = {
    updates: result.updates,
  };

  // 从 schema.ui.revealKind 查表设置对应的 reveal（schema 是单一真相）
  const schema = SCHEMAS[schemaId];
  const revealKind = (schema?.ui as { revealKind?: RevealKind } | undefined)?.revealKind;
  if (revealKind) {
    const handler = REVEAL_HANDLERS[revealKind];
    if (handler) {
      Object.assign(payload, handler(result, targetSeat));
    }
  }

  return payload;
}
