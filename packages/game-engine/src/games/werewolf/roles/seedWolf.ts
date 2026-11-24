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
  action: '感染',
  infection: '感染{seat}',
  attacked: '{seat}被狼人袭击',
  noTarget: '本夜没有可感染的狼人袭击目标',
  actualLanding: '（实际为{seat}）',
  revealTitle: '感染信息',
  infected: '你已被种狼感染并转化为普通狼人',
  notInfected: '你未被感染',
});

const infectStep: WerewolfRoleStepDefinition = {
  id: 'seedWolfInfect',
  title: COPY.action,
  audio: defineWerewolfStepAudio('seedWolf'),
  actors: (context) =>
    context.state.nightNumber === 1
      ? context.state.seatedSeats.filter((seat) =>
          context.role.activeRoleIdsOf(seat).includes('seedWolf'),
        )
      : [],
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
  lock: (context) => getRoleAbilityLockReason(context, 'seedWolf'),
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
