import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep } from './roleSteps';

const COPY = defineCopy({
  name: '乌鸦',
  shortName: '鸦',
  description: '每晚可诅咒一名玩家，被诅咒者在次日白天放逐投票时额外增加一票',
  action: '诅咒',
  announcementTitle: '乌鸦信息',
  announcementTarget: '{seat}被诅咒（放逐+1票）',
  announcementEmpty: '昨夜没有诅咒',
});

export const crow = defineRole({
  id: 'crow',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🐦‍⬛',
    description: COPY.description,
  },
  traits: { faction: 'god', team: 'good' },
  announcement: {
    timing: 'exileVote',
    title: COPY.announcementTitle,
    targetMessage: COPY.announcementTarget,
    emptyMessage: COPY.announcementEmpty,
  },
  steps: [
    createSingleTargetStep({
      id: 'crowCurse',
      roleId: 'crow',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: false,
    }),
  ],
});
