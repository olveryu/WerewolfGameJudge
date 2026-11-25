import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep, getActingSeat } from './roleSteps';

const COPY = defineCopy({
  name: '猩红狼王',
  shortName: '猩',
  description:
    '每晚选择一名玩家附着猩红之子，整局最多附着三名；与普通狼人互不相认；猩红之子在白天公开，被神职技能选中时夜间出局；猩红狼王出局时猩红之子随之出局（恶灵骑士免疫夜间伤害，不受该连带影响）；不能自爆；其余狼人出局后可在夜间发动袭击',
  skillText: '每晚选择一名玩家附着猩红之子，整局最多附着三名',
  passiveText: '与普通狼人互不相认',
  triggerText:
    '猩红之子在白天公开，被神职技能选中时夜间出局；猩红狼王出局时猩红之子随之出局（恶灵骑士免疫夜间伤害，不受该连带影响）',
  restrictionText: '不能自爆',
  specialText: '其余狼人出局后可在夜间发动袭击',
  action: '附着猩红之子',
  announcementTitle: '猩红之子',
  announcementTarget: '猩红之子：{seat}',
});

export const scarletWolfKing = defineRole({
  id: 'scarletWolfKing',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🩸🐺',
    description: COPY.description,
    sections: {
      skill: COPY.skillText,
      passive: COPY.passiveText,
      trigger: COPY.triggerText,
      restriction: COPY.restrictionText,
      special: COPY.specialText,
    },
    tags: ['control', 'link'],
  },
  traits: {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: false, participatesInWolfVote: false },
  },
  announcement: {
    timing: 'beforeSheriff',
    title: COPY.announcementTitle,
    targetMessage: COPY.announcementTarget,
    emptyMessage: '',
    omitWhenEmpty: true,
  },
  steps: [
    createSingleTargetStep({
      id: 'scarletWolfKingMark',
      roleId: 'scarletWolfKing',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: false,
      canTargetSelf: true,
      selectionEffects: (context, selection) => {
        const actorSeat = getActingSeat(context);
        return {
          disabledAbilities: [],
          deathEffects:
            actorSeat === selection.landingSeat
              ? []
              : [
                  {
                    kind: 'link',
                    source: actorSeat,
                    from: actorSeat,
                    to: selection.landingSeat,
                    cause: 'scarletLink',
                    isMutual: false,
                    bypassSurvival: true,
                  },
                ],
        };
      },
    }),
  ],
});
