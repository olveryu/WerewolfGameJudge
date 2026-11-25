import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createViewStep, getActingSeat } from './viewStep';

const COPY = defineCopy({
  canShoot: '可以发动技能',
  cannotShoot: '不能发动技能',
  reviewCanShoot: '可以发动',
  reviewCannotShoot: '不能发动',
  name: '狼王',
  shortName: '王',
  description: '出局时可开枪带走一名玩家；仅被狼人袭击或投票放逐出局时可发动',
  stepTitle: '技能发动确认',
  viewTitle: '技能状态',
});

export const darkWolfKing = defineRole({
  id: 'darkWolfKing',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🖤🐺',
    description: COPY.description,
  },
  traits: {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
  },
  nightSchedule: 'everyNight',
  steps: [
    createViewStep({
      id: 'darkWolfKingConfirm',
      roleId: 'darkWolfKing',
      roleName: COPY.name,
      stepTitle: COPY.stepTitle,
      viewTitle: COPY.viewTitle,
      content: (context) =>
        context.canShootAtNight(getActingSeat(context), 'darkWolfKing')
          ? COPY.canShoot
          : COPY.cannotShoot,
      reviewPhrase: (context) =>
        context.canShootAtNight(getActingSeat(context), 'darkWolfKing')
          ? COPY.reviewCanShoot
          : COPY.reviewCannotShoot,
    }),
  ],
});
