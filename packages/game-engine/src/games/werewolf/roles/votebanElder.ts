import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep } from './roleSteps';

const COPY = defineCopy({
  name: '禁票长老',
  shortName: '票',
  description:
    '每晚可禁票一名玩家，使其次日放逐环节不能投票；不能连续两晚禁票同一人；禁票信息在警下发言时公布',
  action: '禁票',
  announcementTitle: '禁票信息',
  announcementTarget: '{seat}被禁票',
  announcementEmpty: '昨夜没有禁票',
});

export const votebanElder = defineRole({
  id: 'votebanElder',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🚫',
    description: COPY.description,
  },
  traits: { faction: 'god', team: 'good' },
  announcement: {
    timing: 'daySpeech',
    title: COPY.announcementTitle,
    targetMessage: COPY.announcementTarget,
    emptyMessage: COPY.announcementEmpty,
  },
  steps: [
    createSingleTargetStep({
      id: 'votebanElderBan',
      roleId: 'votebanElder',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: true,
      cannotRepeatTarget: true,
    }),
  ],
});
