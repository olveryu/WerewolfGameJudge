import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import type { StepDefinition } from '../../../platform/steps/step';
import { resolveTargetSelection } from './location';
import type { WerewolfNightFacts, WerewolfRoleStepContext, WerewolfRoleStepResult } from './role';

const ROLE_STEP_COPY = defineCopy({
  locked: '你今晚无法使用技能',
  selfTargetDisallowed: '不能选择自己',
  repeatedTargetDisallowed: '不能连续两晚选择同一名玩家',
  actualLanding: '（实际为{seat}）',
  good: '好人',
  wolf: '狼人',
  factionCheckResult: '{seat}是{faction}',
  identityCheckResult: '{seat}是{role}',
});

export interface SingleTargetStepOptions {
  readonly id: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly audioKey?: string;
  readonly actionName: string;
  readonly skippable: boolean;
  readonly canTargetSelf: boolean;
  readonly cannotRepeatTarget?: boolean;
  readonly actorAvailable?: (context: WerewolfRoleStepContext, seat: number) => boolean;
  readonly targetUnavailableReason?: (
    context: WerewolfRoleStepContext,
    targetSeat: number,
  ) => string | null;
  readonly situationHints?: (context: WerewolfRoleStepContext) => readonly string[];
  readonly ruleHints?: (context: WerewolfRoleStepContext) => readonly string[];
  readonly selectionEffects?: (
    context: WerewolfRoleStepContext,
    selection: { readonly chosenSeat: number; readonly landingSeat: number },
  ) => Pick<WerewolfNightFacts, 'disabledAbilities' | 'deathEffects'>;
  readonly result?: (
    context: WerewolfRoleStepContext,
    selection: { readonly chosenSeat: number; readonly landingSeat: number },
  ) => WerewolfRoleStepResult | undefined;
  readonly renderResult?: (
    context: WerewolfRoleStepContext,
    result: WerewolfRoleStepResult,
  ) => { readonly title: string; readonly text: string };
  readonly reviewSuffix?: (context: WerewolfRoleStepContext, chosenSeat: number) => string | null;
}

export function getActingSeat(context: WerewolfRoleStepContext): number {
  if (context.seat === null) {
    throw new Error('[FAIL-FAST] A role action resolved without an acting seat');
  }
  return context.seat;
}

export function createFactionCheckResult(
  context: WerewolfRoleStepContext,
  selection: { readonly chosenSeat: number; readonly landingSeat: number },
  transform: 'identity' | 'invert' | 'random',
): WerewolfRoleStepResult {
  const seenRole = context.role.seenRole(selection.landingSeat);
  const isWolf = context.teamOfRole(seenRole) === 'wolf';
  const resultIsWolf =
    transform === 'identity'
      ? isWolf
      : transform === 'invert'
        ? !isWolf
        : context.randomBoolean()
          ? isWolf
          : !isWolf;
  return {
    kind: 'factionCheck',
    ...selection,
    faction: resultIsWolf ? 'wolf' : 'good',
  };
}

export function createIdentityCheckResult(
  context: WerewolfRoleStepContext,
  selection: { readonly chosenSeat: number; readonly landingSeat: number },
): WerewolfRoleStepResult {
  return {
    kind: 'identityCheck',
    ...selection,
    roleId: context.role.seenRole(selection.landingSeat),
  };
}

export function renderFactionCheckResult(
  result: WerewolfRoleStepResult,
  title: string,
): { readonly title: string; readonly text: string } {
  if (result.kind !== 'factionCheck') {
    throw new Error('[FAIL-FAST] Expected a faction-check result');
  }
  return {
    title,
    text: renderCopy(ROLE_STEP_COPY.factionCheckResult, {
      seat: formatSeat(result.chosenSeat),
      faction: result.faction === 'wolf' ? ROLE_STEP_COPY.wolf : ROLE_STEP_COPY.good,
    }),
  };
}

export function renderIdentityCheckResult(
  context: WerewolfRoleStepContext,
  result: WerewolfRoleStepResult,
  title: string,
): { readonly title: string; readonly text: string } {
  if (result.kind !== 'identityCheck') {
    throw new Error('[FAIL-FAST] Expected an identity-check result');
  }
  return {
    title,
    text: renderCopy(ROLE_STEP_COPY.identityCheckResult, {
      seat: formatSeat(result.chosenSeat),
      role: context.roleNameOf(result.roleId),
    }),
  };
}

export function createSingleTargetStep(
  options: SingleTargetStepOptions,
): StepDefinition<string, WerewolfRoleStepContext, WerewolfNightFacts, WerewolfRoleStepResult> {
  return {
    id: options.id,
    title: options.actionName,
    audio: () => ({
      begin: options.audioKey ?? options.roleId,
      end: options.audioKey ?? options.roleId,
    }),
    actors: (context) =>
      context.state.seatedSeats.filter((seat) => {
        const hasRole = context.role.activeRoleIdsOf(seat).includes(options.roleId);
        const isUsed = context.state.usedAbilities.some(
          (ability) => ability.seat === seat && ability.roleId === options.roleId,
        );
        return hasRole && !isUsed && (options.actorAvailable?.(context, seat) ?? true);
      }),
    actions: [
      {
        kind: 'pickSeats',
        key: options.id,
        name: options.actionName,
        count: { min: 1, max: 1 },
        seats: (context) =>
          context.state.seatedSeats.map((seat) => ({
            seat,
            unavailableReason: getUnavailableReason(context, options, seat),
          })),
        resolve: (context, [chosenSeat]) => {
          if (chosenSeat === undefined || context.seat === null) {
            throw new Error(`[FAIL-FAST] ${options.id} resolved without one actor and target`);
          }
          const selection = resolveTargetSelection(chosenSeat, context.state.location);
          const selectionEffects = options.selectionEffects?.(context, selection);
          const facts: WerewolfNightFacts = {
            selections: [
              {
                roleId: options.roleId,
                actorSeat: context.seat,
                ...selection,
              },
            ],
            disabledAbilities: selectionEffects?.disabledAbilities ?? [],
            deathEffects: selectionEffects?.deathEffects ?? [],
          };
          const result = options.result?.(context, selection);
          return {
            facts,
            ...(result === undefined ? {} : { result }),
          };
        },
      },
    ],
    skippable: () => options.skippable,
    lock: (context) =>
      context.seat !== null &&
      context.facts.disabledAbilities.some(
        (ability) =>
          ability.seat === context.seat &&
          (ability.roleId === options.roleId || ability.roleId === '*'),
      )
        ? ROLE_STEP_COPY.locked
        : null,
    ...(options.situationHints === undefined ? {} : { situationHints: options.situationHints }),
    ...(options.ruleHints === undefined ? {} : { ruleHints: options.ruleHints }),
    ...(options.renderResult === undefined ? {} : { renderResult: options.renderResult }),
    reviewSubject: () => options.roleName,
    reviewSuffix: (context, submission) => {
      const chosenSeat = submission.seats[0];
      if (chosenSeat === undefined) return null;
      const landingSeat = context.role.landing(chosenSeat);
      if (landingSeat !== chosenSeat) {
        return (
          options.reviewSuffix?.(context, chosenSeat) ??
          ROLE_STEP_COPY.actualLanding.replace('{seat}', formatSeat(landingSeat))
        );
      }
      return options.reviewSuffix?.(context, chosenSeat) ?? null;
    },
  };
}

function getUnavailableReason(
  context: WerewolfRoleStepContext,
  options: SingleTargetStepOptions,
  targetSeat: number,
): string | null {
  if (!options.canTargetSelf && targetSeat === context.seat) {
    return ROLE_STEP_COPY.selfTargetDisallowed;
  }
  if (
    options.cannotRepeatTarget === true &&
    context.seat !== null &&
    context.state.previousTargets.some(
      (target) =>
        target.roleId === options.roleId &&
        target.actorSeat === context.seat &&
        target.targetSeat === context.role.landing(targetSeat),
    )
  ) {
    return ROLE_STEP_COPY.repeatedTargetDisallowed;
  }
  const reason = options.targetUnavailableReason?.(context, targetSeat);
  if (reason !== undefined && reason !== null) return reason;
  return null;
}
