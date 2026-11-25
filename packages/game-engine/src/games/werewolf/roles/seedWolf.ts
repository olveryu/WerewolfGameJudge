import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import { defineWerewolfStepAudio } from './audio';
import { type DeathEffect, resolveDeathEffects } from './deathEffects';
import type {
  WerewolfNightFacts,
  WerewolfRoleStepContext,
  WerewolfRoleStepDefinition,
} from './role';
import { defineRole } from './role';
import { createGroupConfirmStep, getActingSeat, getRoleAbilityLockReason } from './roleSteps';

const COPY = defineCopy({
  name: '种狼',
  shortName: '种',
  emoji: '🌱🐺',
  description:
    '首夜在狼人袭击后可感染袭击目标；不能感染狼人目标；若目标最终因狼人袭击出局，则取消该次袭击并将其转化为普通狼人；被转化者当夜原技能失效',
  skillText: '首夜在狼人袭击后可感染袭击目标',
  restrictionText: '不能感染狼人目标',
  specialText:
    '若目标最终因狼人袭击出局，则取消该次袭击并将其转化为普通狼人；被转化者当夜原技能失效',
  action: '感染',
  infection: '感染{seat}',
  attacked: '{seat}被狼人袭击',
  noTarget: '本夜没有可感染的狼人袭击目标',
  actualLanding: '（实际为{seat}）',
  revealTitle: '感染信息',
  infected: '你已被种狼感染并转化为普通狼人',
  notInfected: '你未被感染',
  convertedLocked: '已转化为狼人，本夜无法使用技能',
});

const infectStep: WerewolfRoleStepDefinition = {
  id: 'seedWolfInfect',
  title: COPY.action,
  audio: defineWerewolfStepAudio('seedWolf'),
  actors: (context) =>
    context.state.seatedSeats.filter((seat) =>
      context.role.activeRoleIdsOf(seat).includes('seedWolf'),
    ),
  situationHints: (context) => {
    const target = getInfectionTarget(context);
    return target === null
      ? [COPY.noTarget]
      : [renderCopy(COPY.attacked, { seat: formatSeat(target) })];
  },
  actions: [
    {
      kind: 'direct',
      key: 'seedWolfInfect',
      name: COPY.action,
      target: getInfectionTarget,
      phrase: (seat) => `${COPY.action}${formatSeat(seat)}`,
      availability: (context) =>
        getInfectionTarget(context) === null
          ? { kind: 'unavailable', reason: COPY.noTarget }
          : { kind: 'available' },
      resolve: (context) => {
        const chosenSeat = getInfectionTarget(context);
        if (chosenSeat === null) {
          throw new Error('[FAIL-FAST] Seed wolf infected without an eligible wolf target');
        }
        return {
          facts: {
            wolfInfections: [
              { actorSeat: getActingSeat(context), targetSeat: context.role.landing(chosenSeat) },
            ],
          },
        };
      },
    },
  ],
  skippable: () => true,
  lock: getRoleAbilityLockReason,
  reviewSubject: () => COPY.name,
  reviewSuffix: (context, submission) => {
    const chosenSeat = submission.seats[0];
    if (chosenSeat === undefined) return null;
    const landingSeat = context.role.landing(chosenSeat);
    return landingSeat === chosenSeat
      ? null
      : renderCopy(COPY.actualLanding, { seat: formatSeat(landingSeat) });
  },
};

const infectRevealStep = createGroupConfirmStep({
  id: 'seedWolfInfectReveal',
  roleName: COPY.name,
  title: COPY.revealTitle,
  content: (context) =>
    context.facts.wolfInfections?.some((infection) => infection.targetSeat === context.seat) &&
    context.seat !== null &&
    context.role.roleOf(context.seat) === 'wolf'
      ? COPY.infected
      : COPY.notInfected,
});

export const seedWolf = defineRole({
  id: 'seedWolf',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: COPY.emoji,
    description: COPY.description,
    sections: {
      skill: COPY.skillText,
      restriction: COPY.restrictionText,
      special: COPY.specialText,
    },
    tags: ['transform'],
  },
  traits: {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
  },
  nightSchedule: 'firstNight',
  steps: [infectStep, infectRevealStep],
});

function getInfectionTarget(context: WerewolfRoleStepContext): number | null {
  const targetSeat = context.resolvedWolfKillTarget;
  if (targetSeat === null) return null;
  const landingSeat = context.role.landing(targetSeat);
  return context.factionOfRole(context.role.roleOf(landingSeat)) === 'wolf' ? null : targetSeat;
}

/**
 * The step after which the infection is decided: the last later step whose actor can still
 * undo the wolf attack, or the infection step itself when nobody can.
 */
export function getInfectionSettlementStepId(
  order: readonly string[],
  definitions: Readonly<Record<string, WerewolfRoleStepDefinition>>,
  context: WerewolfRoleStepContext,
): string | null {
  const infectIndex = order.indexOf(infectStep.id);
  if (infectIndex === -1) return null;
  const rescueStepId = order
    .slice(infectIndex + 1)
    .findLast((stepId) => definitions[stepId]?.canRescueWolfKillTarget?.(context) === true);
  return rescueStepId ?? infectStep.id;
}

/** Keep a converted player in their former role's later steps, with every skill locked. */
export function withConversionLock(
  step: WerewolfRoleStepDefinition,
  ownerRoleId: string,
): WerewolfRoleStepDefinition {
  if (step.audience === 'allSeats') return step;
  const getConvertedActors = (context: WerewolfRoleStepContext): readonly number[] =>
    (context.facts.conversions ?? [])
      .filter((conversion) => conversion.formerRoleIds.includes(ownerRoleId))
      .map((conversion) => conversion.seat);
  const isConvertedActor = (context: WerewolfRoleStepContext): boolean =>
    context.seat !== null && getConvertedActors(context).includes(context.seat);
  return {
    ...step,
    actors: (context) => {
      const actors = step.actors(context);
      const converted = getConvertedActors(context).filter((seat) => !actors.includes(seat));
      return converted.length === 0
        ? actors
        : [...actors, ...converted].sort((first, second) => first - second);
    },
    lock: (context) =>
      isConvertedActor(context) ? COPY.convertedLocked : (step.lock?.(context) ?? null),
    situationHints: (context) =>
      isConvertedActor(context) ? [COPY.infected] : (step.situationHints?.(context) ?? []),
  };
}

export function resolveSeedWolfInfection(
  facts: WerewolfNightFacts,
  effects: readonly DeathEffect[],
): { readonly outcome: 'converted' | 'failed'; readonly targetSeat: number } | null {
  const infection = facts.wolfInfections?.[0];
  if (infection === undefined) return null;
  const causes = resolveDeathEffects(effects).causes[infection.targetSeat] ?? [];
  return {
    outcome: causes.includes('wolfKill') ? 'converted' : 'failed',
    targetSeat: infection.targetSeat,
  };
}
