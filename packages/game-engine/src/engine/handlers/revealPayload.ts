/**
 * Reveal payload builder.
 *
 * Maps resolver output to the `APPLY_RESOLVER_RESULT` action payload
 * using the schema's `revealKind` as dispatch key.
 * Adding a new RevealKind forces a compile error in REVEAL_HANDLERS.
 */

import { type RevealKind, type SchemaId, SCHEMAS } from '../../models';
import type { ResolverResult } from '../../resolvers/types';
import type { ApplyResolverResultAction } from '../reducer/types';

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

  // Gate: if learned hunter, set gate to false (requires viewing before advancing)
  if (learnedRoleId === 'hunter') {
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
