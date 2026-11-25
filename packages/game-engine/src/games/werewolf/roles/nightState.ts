import { z } from 'zod';

import type { StepSlice } from '../../../platform/steps';
import { isValidRoleId } from '../domain/models';
import { isNightStepId } from '../domain/models/roles/spec/nightStepIds';
import type { ResolvedWolfKillVerdict, SeedWolfInfectionResult } from '../domain/protocol/types';
import type { DeathEffect } from './deathEffects';
import type { WerewolfNightFacts, WerewolfRoleState, WerewolfRoleStepResult } from './role';

export interface WerewolfNightEmission {
  readonly stepId: string;
  readonly actorSeat: number;
  readonly actionKey: string;
  readonly facts: Partial<WerewolfNightFacts>;
}

/** Persistent state of the spec-driven night, retained for the night report. */
export interface WerewolfNightState {
  readonly slice: StepSlice<string, WerewolfRoleStepResult>;
  readonly roles: WerewolfRoleState;
  readonly facts: WerewolfNightFacts;
  readonly emissions: readonly WerewolfNightEmission[];
  readonly wolfKill: {
    readonly target: number | null;
    readonly verdict: ResolvedWolfKillVerdict | null;
    readonly attack: DeathEffect | null;
  } | null;
  readonly infection: SeedWolfInfectionResult | null;
}

const seat = z.number().int().nonnegative();
const seatKey = z.string().regex(/^(0|[1-9]\d*)$/);
const roleId = z.string().refine(isValidRoleId, 'Expected a registered role');
const stepId = z.string().refine(isNightStepId, 'Expected a registered night step');
const attackCause = z.enum(['wolfKill', 'poison', 'checkDeath']);
const linkCause = z.enum(['wolfQueenLink', 'bondedLink', 'coupleLink', 'dreamcatcherLink']);
const deathEffect = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('attack'),
    cause: attackCause,
    source: seat.nullable(),
    target: seat,
  }),
  z.strictObject({
    kind: z.literal('protect'),
    source: seat,
    target: seat,
    against: z.array(attackCause),
    conflictGroup: z.string().nullable(),
  }),
  z.strictObject({
    kind: z.literal('shelter'),
    source: seat,
    target: seat,
    bypassable: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal('link'),
    source: seat.nullable(),
    from: seat,
    to: seat,
    cause: linkCause,
    isMutual: z.boolean(),
    bypassShelter: z.boolean().optional(),
  }),
  z.strictObject({ kind: z.literal('immune'), seat, against: z.array(attackCause) }),
  z.strictObject({ kind: z.literal('reflect'), seat, against: z.array(attackCause) }),
  z.strictObject({
    kind: z.literal('void'),
    scope: z.union([
      z.strictObject({ source: seat }),
      z.strictObject({ cause: attackCause, target: seat }),
    ]),
  }),
]);
const identityChange = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('replaceCurrentRole'), seat, roleId }),
  z.strictObject({ kind: z.literal('grantBorrowedAbility'), seat, roleId }),
]);
const roleAbilityId = z.union([roleId, z.literal('*'), z.literal('wolfKill')]);
const roleAbility = z.strictObject({ roleId: roleAbilityId, seat });
const swap = z.strictObject({ first: seat, second: seat });
const wolfVote = z.strictObject({
  actorSeat: seat,
  chosenSeat: seat.nullable(),
  landingSeat: seat.nullable(),
});
const facts = z.strictObject({
  selections: z.array(
    z.strictObject({ roleId, actorSeat: seat, chosenSeat: seat, landingSeat: seat }),
  ),
  identityChanges: z.array(identityChange),
  cardSelections: z.array(z.strictObject({ roleId, actorSeat: seat, cardIndex: seat })),
  disabledAbilities: z.array(roleAbility),
  deathEffects: z.array(deathEffect),
  wolfVotes: z.array(wolfVote).optional(),
  locationSwaps: z.array(swap).optional(),
  resourceUses: z.array(z.strictObject({ roleId, seat, resource: z.string().min(1) })).optional(),
  factionChanges: z
    .array(
      z.strictObject({
        seat,
        faction: z.enum(['god', 'villager', 'wolf', 'special']),
      }),
    )
    .optional(),
  wolfInfections: z.array(z.strictObject({ actorSeat: seat, targetSeat: seat })).optional(),
  wolfGirlConfessions: z.array(z.strictObject({ actorSeat: seat, targetSeat: seat })).optional(),
  sightOverrides: z.array(z.strictObject({ seat, roleId })).optional(),
  conversions: z.array(z.strictObject({ seat, formerRoleIds: z.array(roleId) })).optional(),
});
const roleState = z.strictObject({
  identities: z.record(
    seatKey,
    z.strictObject({
      dealtRole: roleId,
      currentRole: roleId,
      borrowedAbilityRole: roleId.nullable(),
    }),
  ),
  location: z.strictObject({ swap: swap.nullable() }),
  sight: z.strictObject({ roleOverridesBySeat: z.record(seatKey, roleId) }),
  seatedSeats: z.array(seat),
  rules: z.strictObject({ witchCanSelfHeal: z.boolean() }),
  usedResources: z.array(z.strictObject({ roleId, seat, resource: z.string().min(1) })),
});
const result = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('factionCheck'),
    chosenSeat: seat,
    landingSeat: seat,
    faction: z.enum(['good', 'wolf']),
  }),
  z.strictObject({ kind: z.literal('identityCheck'), chosenSeat: seat, landingSeat: seat, roleId }),
  z.strictObject({ kind: z.literal('cardSelection'), roleId }),
]);
const seatRecord = z.strictObject({
  submissions: z.array(
    z.strictObject({
      actionKey: z.string().min(1),
      seats: z.array(seat),
      cardIndex: seat.nullable(),
    }),
  ),
  result: result.nullable(),
  isResultAcknowledged: z.boolean(),
});
const slice = z.strictObject({
  order: z.array(stepId),
  current: z.strictObject({ stepId, serial: z.number().int().nonnegative() }).nullable(),
  records: z.record(stepId, z.strictObject({ bySeat: z.record(seatKey, seatRecord) })),
  deadlineMs: z.number().int().nonnegative().nullable(),
});
const verdict = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('sharedTarget'), targetSeat: seat }),
  z.strictObject({ type: z.literal('splitKilled'), targetSeat: seat }),
  z.strictObject({ type: z.literal('tiePicked'), targetSeat: seat }),
  z.strictObject({ type: z.literal('splitTied') }),
  z.strictObject({ type: z.literal('allAbstain') }),
]);
const infection = z.discriminatedUnion('outcome', [
  z.strictObject({ outcome: z.literal('notUsed') }),
  z.strictObject({ outcome: z.literal('failed'), targetSeat: seat }),
  z.strictObject({ outcome: z.literal('converted'), targetSeat: seat }),
]);
const nightStateSchema = z.strictObject({
  slice,
  roles: roleState,
  facts,
  emissions: z.array(
    z.strictObject({
      stepId,
      actorSeat: seat,
      actionKey: z.string().min(1),
      facts: facts.partial(),
    }),
  ),
  wolfKill: z
    .strictObject({
      target: seat.nullable(),
      verdict: verdict.nullable(),
      attack: deathEffect.nullable(),
    })
    .nullable(),
  infection: infection.nullable(),
}) satisfies z.ZodType<WerewolfNightState>;

/** Reject malformed persisted night state instead of attempting a migration. */
export function parseWerewolfNightState(value: unknown, path: string): WerewolfNightState {
  const parsed = nightStateSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `${path}${issue?.path.map((part) => `.${String(part)}`).join('') ?? ''}: ${issue?.message ?? 'invalid night state'}`,
    );
  }
  const state = parsed.data;
  if (
    new Set(state.slice.order).size !== state.slice.order.length ||
    (state.slice.current !== null && !state.slice.order.includes(state.slice.current.stepId))
  ) {
    throw new Error(`${path}.slice must contain a unique ordered current step`);
  }
  const seats = new Set(state.roles.seatedSeats);
  if (
    seats.size !== state.roles.seatedSeats.length ||
    Object.keys(state.roles.identities).some((key) => !seats.has(Number(key))) ||
    state.roles.seatedSeats.some((number) => state.roles.identities[number] === undefined)
  ) {
    throw new Error(`${path}.roles must contain exactly one identity for each seated player`);
  }
  return state;
}
