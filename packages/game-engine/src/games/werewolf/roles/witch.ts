import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import type { SeatSubmissionForReview } from '../../../platform/steps/step';
import { defineWerewolfStepAudio } from './audio';
import type { DeathEffect } from './deathEffects';
import { resolveTargetSelection } from './location';
import type { WerewolfRoleStepContext, WerewolfRoleStepDefinition } from './role';
import { defineRole } from './role';
import { getActingSeat, getRoleAbilityLockReason, resolveRoleTarget } from './roleSteps';

const COPY = defineCopy({
  name: '女巫',
  shortName: '女',
  emoji: '🧙‍♀️',
  description:
    '拥有一瓶解药和一瓶毒药；每晚可救活被狼人袭击的玩家或毒杀一名玩家；每瓶药限用一次；不能自救；被毒杀的角色无法开枪',
  stepTitle: '女巫行动',
  antidote: '用解药',
  antidoteOn: '对{seat}用解药',
  poison: '毒杀',
  poisoned: '毒杀{seat}',
  selfAttacked: '你被狼人袭击',
  attacked: '{seat}被狼人袭击',
  peacefulNight: '昨夜平安夜',
  selfSaveDisallowed: '本局规则不允许自救',
  antidoteUsed: '解药已用完',
  poisonUsed: '毒药已用完',
  actualLanding: '（实际为{seat}）',
});

const witchActionStep: WerewolfRoleStepDefinition = {
  id: 'witchAction',
  title: COPY.stepTitle,
  audio: defineWerewolfStepAudio('witch'),
  actors: (context) =>
    context.state.seatedSeats.filter((seat) =>
      context.role.activeRoleIdsOf(seat).includes('witch'),
    ),
  canRescueWolfKillTarget: (context) => {
    const target = context.resolvedWolfKillTarget;
    if (target === null) return false;
    return context.state.seatedSeats.some(
      (seat) =>
        context.role.activeRoleIdsOf(seat).includes('witch') &&
        (seat !== target || context.state.rules.witchCanSelfHeal),
    );
  },
  situationHints: (context) => {
    const target = context.resolvedWolfKillTarget;
    if (target === null) return [COPY.peacefulNight];
    if (target === context.seat) return [COPY.selfAttacked];
    return [renderCopy(COPY.attacked, { seat: formatSeat(target) })];
  },
  actions: [
    {
      kind: 'direct',
      key: 'antidote',
      name: COPY.antidote,
      reviewWhenUnused: true,
      target: (context) => context.resolvedWolfKillTarget,
      phrase: (seat) => renderCopy(COPY.antidoteOn, { seat: formatSeat(seat) }),
      availability: (context) => {
        const seat = getActingSeat(context);
        if (context.resolvedWolfKillTarget === null) return { kind: 'hidden' };
        if (hasUsedResource(context, seat, 'antidote')) {
          return { kind: 'unavailable', reason: COPY.antidoteUsed };
        }
        return context.resolvedWolfKillTarget === seat && !context.state.rules.witchCanSelfHeal
          ? { kind: 'unavailable', reason: COPY.selfSaveDisallowed }
          : { kind: 'available' };
      },
      resolve: (context) => {
        const seat = getActingSeat(context);
        const target = context.resolvedWolfKillTarget;
        if (target === null) throw new Error('[FAIL-FAST] Witch used an antidote without a target');
        const deathEffect: DeathEffect = {
          kind: 'protect',
          source: seat,
          // The antidote answers the attack itself, so a time-rift shelter does not turn it back.
          target: resolveTargetSelection(target, context.state.location).landingSeat,
          against: ['wolfKill'],
          conflictGroup: 'wolfSave',
        };
        return {
          facts: {
            deathEffects: [deathEffect],
            resourceUses: [{ roleId: 'witch', seat, resource: 'antidote' }],
          },
        };
      },
    },
    {
      kind: 'pickSeats',
      key: 'poison',
      name: COPY.poison,
      reviewWhenUnused: true,
      count: { min: 1, max: 1 },
      phrase: (seats) =>
        seats[0] === undefined
          ? COPY.poison
          : renderCopy(COPY.poisoned, { seat: formatSeat(seats[0]) }),
      seats: (context) =>
        context.state.seatedSeats.map((seat) => ({ seat, unavailableReason: null })),
      availability: (context) =>
        context.seat !== null && hasUsedResource(context, context.seat, 'poison')
          ? { kind: 'unavailable', reason: COPY.poisonUsed }
          : { kind: 'available' },
      resolve: (context, [chosenSeat]) => {
        if (chosenSeat === undefined) throw new Error('[FAIL-FAST] Witch poison has no target');
        const seat = getActingSeat(context);
        const selection = resolveRoleTarget(context, chosenSeat);
        return {
          facts: {
            selections: [
              {
                roleId: 'witch',
                actorSeat: seat,
                ...selection,
              },
            ],
            deathEffects: [
              { kind: 'attack', cause: 'poison', source: seat, target: selection.landingSeat },
            ],
            resourceUses: [{ roleId: 'witch', seat, resource: 'poison' }],
          },
        };
      },
    },
  ],
  skippable: () => true,
  lock: getRoleAbilityLockReason,
  reviewSubject: () => COPY.name,
  reviewSuffix: (context, submission: SeatSubmissionForReview) => {
    if (submission.actionKey !== 'poison' && submission.actionKey !== 'antidote') return null;
    const chosenSeat = submission.seats[0];
    if (chosenSeat === undefined) return null;
    const landingSeat = context.role.landing(chosenSeat);
    return landingSeat === chosenSeat
      ? null
      : renderCopy(COPY.actualLanding, { seat: formatSeat(landingSeat) });
  },
};

export const witch = defineRole({
  id: 'witch',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: COPY.emoji,
    description: COPY.description,
  },
  traits: { faction: 'god', team: 'good' },
  nightSchedule: 'everyNight',
  resources: [
    { kind: 'antidote', uses: 1, refreshPerNight: false },
    { kind: 'poison', uses: 1, refreshPerNight: false },
  ],
  steps: [witchActionStep],
});

function hasUsedResource(
  context: WerewolfRoleStepContext,
  seat: number,
  resource: string,
): boolean {
  return context.state.usedResources.some(
    (used) => used.roleId === 'witch' && used.seat === seat && used.resource === resource,
  );
}
