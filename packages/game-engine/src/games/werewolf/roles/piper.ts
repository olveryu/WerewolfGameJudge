import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import type { StepDefinition } from '../../../platform/steps/step';
import { resolveTargetSelection } from './location';
import type { WerewolfNightFacts, WerewolfRoleStepContext, WerewolfRoleStepResult } from './role';
import { defineRole } from './role';
import { createGroupConfirmStep, getActingSeat, getRoleAbilityLockReason } from './roleSteps';

const COPY = defineCopy({
  name: '吹笛者',
  shortName: '笛',
  emoji: '🪈',
  description:
    '每晚可选择一至两名玩家进行催眠；被催眠的玩家会醒来互相确认；当所有其他存活玩家均被催眠时获胜；若好人或狼人任一方先达成胜利条件，游戏结束，吹笛者判负',
  action: '催眠',
  prompt: '请选择 1-2 名要催眠的玩家',
  selfDisallowed: '不能选择自己',
  seatSeparator: '、',
  selection: '催眠{seats}',
  actualLanding: '（实际为{seats}）',
  revealTitle: '催眠信息',
  hypnotized: '你已被吹笛者催眠，当前被催眠的座位：{seats}',
  notHypnotized: '你未被催眠',
});

const hypnotizeStep: StepDefinition<
  string,
  WerewolfRoleStepContext,
  WerewolfNightFacts,
  WerewolfRoleStepResult
> = {
  id: 'piperHypnotize',
  title: COPY.action,
  audio: () => ({ begin: 'piper', end: 'piper' }),
  actors: (context) =>
    context.state.seatedSeats.filter((seat) =>
      context.role.activeRoleIdsOf(seat).includes('piper'),
    ),
  actions: [
    {
      kind: 'pickSeats',
      key: 'piperHypnotize',
      name: COPY.action,
      count: { min: 1, max: 2 },
      prompt: COPY.prompt,
      seats: (context) =>
        context.state.seatedSeats.map((seat) => ({
          seat,
          unavailableReason: seat === context.seat ? COPY.selfDisallowed : null,
        })),
      phrase: (seats) =>
        renderCopy(COPY.selection, {
          seats: seats.map(formatSeat).join(COPY.seatSeparator),
        }),
      resolve: (context, chosenSeats) => {
        if (
          chosenSeats.length < 1 ||
          chosenSeats.length > 2 ||
          new Set(chosenSeats).size !== chosenSeats.length
        ) {
          throw new Error('[FAIL-FAST] Piper must choose one or two distinct targets');
        }
        const actorSeat = getActingSeat(context);
        const selections = chosenSeats.map((chosenSeat) => ({
          roleId: 'piper',
          actorSeat,
          ...resolveTargetSelection(chosenSeat, context.state.location),
        }));
        return { facts: { selections } };
      },
    },
  ],
  skippable: () => true,
  lock: (context) => getRoleAbilityLockReason(context, 'piper'),
  reviewSubject: () => COPY.name,
  reviewSuffix: (context, submission) => {
    const chosenSeats = submission.seats;
    const landingSeats = chosenSeats.map((seat) => context.role.landing(seat));
    return landingSeats.every((seat, index) => seat === chosenSeats[index])
      ? null
      : renderCopy(COPY.actualLanding, {
          seats: landingSeats.map(formatSeat).join(COPY.seatSeparator),
        });
  },
};

const hypnotizedRevealStep = createGroupConfirmStep({
  id: 'piperHypnotizedReveal',
  roleName: COPY.name,
  title: COPY.revealTitle,
  content: (context) => {
    const viewerSeat = getActingSeat(context);
    const hypnotizedSeats = new Set(
      context.state.previousTargets
        .filter((target) => target.roleId === 'piper')
        .map((target) => target.targetSeat),
    );
    for (const selection of context.facts.selections) {
      if (selection.roleId === 'piper') hypnotizedSeats.add(selection.landingSeat);
    }
    if (!hypnotizedSeats.has(viewerSeat)) return COPY.notHypnotized;
    return COPY.hypnotized.replace(
      '{seats}',
      [...hypnotizedSeats]
        .sort((first, second) => first - second)
        .map(formatSeat)
        .join(COPY.seatSeparator),
    );
  },
});

export const piper = defineRole({
  id: 'piper',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: COPY.emoji,
    description: COPY.description,
  },
  traits: { faction: 'special', team: 'third' },
  nightSchedule: 'everyNight',
  steps: [hypnotizeStep, hypnotizedRevealStep],
});
