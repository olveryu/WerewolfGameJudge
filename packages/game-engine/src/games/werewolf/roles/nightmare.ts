import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep } from './roleSteps';

const COPY = defineCopy({
  name: '噩梦之影',
  shortName: '魇',
  description:
    '每晚在多数角色行动之前恐惧一名玩家，使其当夜无法使用技能；不能连续两晚恐惧同一人；首夜行动时尚未与狼队互认；若恐惧到狼人，狼人阵营当夜无法袭击',
  action: '恐惧',
});

export const nightmare = defineRole({
  id: 'nightmare',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '😱',
    description: COPY.description,
  },
  traits: {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true, actsSolo: true },
  },
  steps: [
    createSingleTargetStep({
      id: 'nightmareBlock',
      roleId: 'nightmare',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: true,
      cannotRepeatTarget: true,
      selectionEffects: (_context, selection) => ({
        disabledAbilities: [{ roleId: '*', seat: selection.landingSeat }],
        deathEffects: [],
      }),
    }),
  ],
});
