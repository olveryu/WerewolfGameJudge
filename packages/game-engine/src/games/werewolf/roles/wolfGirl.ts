import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createGroupConfirmStep, createSingleTargetStep, getActingSeat } from './roleSteps';

const COPY = defineCopy({
  name: '狼女孩',
  shortName: '孩',
  emoji: '👧🐺',
  description:
    '首夜必须表白一名非狼队玩家；表白时可见狼队友号码，不知被表白者是神是民；白天发言环节与投票放逐后均可自爆带走被表白者；投票放逐后自爆则本轮投票作废、直接入夜；自爆后两人均无遗言；不能表白狼队玩家；被表白者查验为好人；被表白的平民成为狼伴侣，不入狼队；狼伴侣与狼人同一胜利条件；狼伴侣知晓狼女孩号码；被表白的神牌仅知自己被表白，仍帮好人玩；仅被自爆带走的猎人无法开枪',
  action: '表白',
  confess: '向{seat}表白',
  wolfTargetDisallowed: '不能选择狼人阵营的玩家',
  revealTitle: '表白信息',
  confessedVillager: '你被表白了，狼女孩是：{seat}',
  confessed: '你被表白了',
  notConfessed: '你未被表白',
});

const confessStep = createSingleTargetStep({
  id: 'wolfGirlConfess',
  roleId: 'wolfGirl',
  roleName: COPY.name,
  actionName: COPY.action,
  phrase: (seats) => {
    const seat = seats[0];
    return seat === undefined ? COPY.action : renderCopy(COPY.confess, { seat: formatSeat(seat) });
  },
  skippable: false,
  canTargetSelf: false,
  actorAvailable: (context) => context.state.nightNumber === 1,
  targetUnavailableReason: (context, chosenSeat) => {
    const targetRole = context.role.roleOf(chosenSeat);
    return context.factionOfRole(targetRole) === 'wolf' ? COPY.wolfTargetDisallowed : null;
  },
  selectionEffects: (context, selection) => ({
    disabledAbilities: [],
    deathEffects: [],
    wolfGirlConfessions:
      context.factionOfRole(context.role.roleOf(selection.landingSeat)) === 'wolf'
        ? []
        : [{ actorSeat: getActingSeat(context), targetSeat: selection.landingSeat }],
  }),
});

const confessRevealStep = createGroupConfirmStep({
  id: 'wolfGirlConfessReveal',
  roleName: COPY.name,
  title: COPY.revealTitle,
  content: (context) => {
    const confession = context.facts.wolfGirlConfessions?.find(
      (entry) => entry.targetSeat === context.seat,
    );
    if (confession === undefined) return COPY.notConfessed;
    return context.factionOfRole(context.role.roleOf(confession.targetSeat)) === 'villager'
      ? renderCopy(COPY.confessedVillager, { seat: formatSeat(confession.actorSeat) })
      : COPY.confessed;
  },
});

export const wolfGirl = defineRole({
  id: 'wolfGirl',
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
  steps: [confessStep, confessRevealStep],
});
