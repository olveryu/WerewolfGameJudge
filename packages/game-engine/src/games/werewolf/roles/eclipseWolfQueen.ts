import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep } from './roleSteps';

const COPY = defineCopy({
  name: '蚀时狼妃',
  shortName: '蚀',
  description:
    '每晚率先睁眼选择一名玩家放逐到时间裂隙；当晚神职对被放逐者释放的技能反弹至施法者自身；不能连续两晚放逐同一人；技能成功触发后永久失去技能',
  action: '放逐',
});

export const eclipseWolfQueen = defineRole({
  id: 'eclipseWolfQueen',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🌘🐺',
    description: COPY.description,
  },
  traits: {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
  },
  oneUseOnSuccess: true,
  steps: [
    createSingleTargetStep({
      id: 'eclipseWolfQueenShelter',
      roleId: 'eclipseWolfQueen',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: true,
      cannotRepeatTarget: true,
    }),
  ],
});
