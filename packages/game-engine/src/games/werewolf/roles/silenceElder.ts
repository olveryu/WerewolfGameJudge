import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep } from './roleSteps';

const COPY = defineCopy({
  name: '禁言长老',
  shortName: '禁',
  description:
    '每晚可禁言一名玩家，使其次日警下发言阶段只能用肢体动作表达；不能连续两晚禁言同一人；禁言信息在警下发言时公布',
  action: '禁言',
  announcementTitle: '禁言信息',
  announcementTarget: '{seat}被禁言',
  announcementEmpty: '昨夜没有禁言',
});

export const silenceElder = defineRole({
  id: 'silenceElder',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🤫',
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
      id: 'silenceElderSilence',
      roleId: 'silenceElder',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: true,
      cannotRepeatTarget: true,
    }),
  ],
});
