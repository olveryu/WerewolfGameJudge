import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import { defineWerewolfStepAudio } from './audio';
import { resolveTargetSelection } from './location';
import type { WerewolfRoleStepContext, WerewolfRoleStepDefinition } from './role';
import { defineRole } from './role';
import {
  createGroupConfirmStep,
  getActingSeat,
  getRoleAbilityLock,
  getWolfTeammateRestriction,
} from './roleSteps';

const COPY = defineCopy({
  name: '觉醒石像鬼',
  shortName: '石',
  emoji: '🗿🔥',
  description:
    '首夜必须选择一名与狼人阵营相邻的玩家转化至狼人阵营；被转化者天亮前知晓转变；被转化者不入狼队，保留自身技能；被转化者不能自爆；其他狼人全部出局后失去原技能并主导袭击',
  skillText: '首夜必须选择一名与狼人阵营相邻的玩家转化至狼人阵营',
  specialText:
    '被转化者天亮前知晓转变；被转化者不入狼队，保留自身技能；被转化者不能自爆；其他狼人全部出局后失去原技能并主导袭击',
  action: '转化',
  prompt: '请选择狼人阵营相邻的一名神民角色进行转化',
  selfDisallowed: '不能选择自己',
  adjacencyDisallowed: '只能选择与狼人阵营相邻的玩家',
  conversion: '转化{seat}',
  actualLanding: '（实际为{seat}）',
  revealTitle: '转化信息',
  converted: '你已被觉醒石像鬼转化为狼人阵营',
  notConverted: '你未被转化',
});

const convertStep: WerewolfRoleStepDefinition = {
  id: 'awakenedGargoyleConvert',
  title: COPY.action,
  audio: defineWerewolfStepAudio('awakenedGargoyle'),
  actors: (context) =>
    context.state.seatedSeats.filter((seat) =>
      context.role.activeRoleIdsOf(seat).includes('awakenedGargoyle'),
    ),
  actions: [
    {
      kind: 'pickSeats',
      key: 'awakenedGargoyleConvert',
      name: COPY.action,
      count: { min: 1, max: 1 },
      prompt: COPY.prompt,
      seats: (context) =>
        context.state.seatedSeats.map((seat) => ({
          seat,
          unavailableReason: getTargetUnavailableReason(context, seat),
        })),
      phrase: (seats) => {
        const seat = seats[0];
        return seat === undefined
          ? COPY.action
          : renderCopy(COPY.conversion, { seat: formatSeat(seat) });
      },
      resolve: (context, [chosenSeat]) => {
        if (chosenSeat === undefined)
          throw new Error('[FAIL-FAST] Awakened gargoyle has no target');
        const actorSeat = getActingSeat(context);
        const selection = resolveTargetSelection(chosenSeat, context.state.location);
        const reason = getTargetUnavailableReason(context, chosenSeat);
        if (reason !== null) {
          throw new Error('[FAIL-FAST] Awakened gargoyle target is unavailable');
        }
        return {
          facts: {
            selections: [{ roleId: 'awakenedGargoyle', actorSeat, ...selection }],
            identityChanges: [],
            cardSelections: [],
            disabledAbilities: [],
            deathEffects: [],
            factionChanges:
              context.teamOfRole(context.role.roleOf(selection.landingSeat)) === 'wolf'
                ? []
                : [{ seat: selection.landingSeat, faction: 'wolf' }],
          },
        };
      },
    },
  ],
  skippable: () => false,
  lock: getRoleAbilityLock,
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

const convertRevealStep = createGroupConfirmStep({
  id: 'awakenedGargoyleConvertReveal',
  roleName: COPY.name,
  title: COPY.revealTitle,
  content: (context) =>
    context.facts.factionChanges?.some(
      (change) => change.seat === context.seat && change.faction === 'wolf',
    )
      ? COPY.converted
      : COPY.notConverted,
});

export const awakenedGargoyle = defineRole({
  id: 'awakenedGargoyle',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: COPY.emoji,
    description: COPY.description,
    sections: { skill: COPY.skillText, special: COPY.specialText },
    tags: ['transform'],
  },
  traits: {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
  },
  steps: [convertStep, convertRevealStep],
});

function getTargetUnavailableReason(
  context: WerewolfRoleStepContext,
  chosenSeat: number,
): string | null {
  if (chosenSeat === context.seat) return COPY.selfDisallowed;
  const teammateRestriction = getWolfTeammateRestriction(context, chosenSeat);
  if (teammateRestriction !== null) return teammateRestriction;
  return context.isAdjacentToWolfFaction(chosenSeat) ? null : COPY.adjacencyDisallowed;
}
