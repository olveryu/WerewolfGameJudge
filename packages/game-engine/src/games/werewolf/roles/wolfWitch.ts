import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import {
  createIdentityCheckResult,
  createSingleTargetStep,
  getWolfTeammateRestriction,
  renderIdentityCheckResult,
} from './roleSteps';

const COPY = defineCopy({
  name: '狼巫',
  shortName: '巫',
  description:
    '每晚可查验一名非狼人阵营玩家的身份，获知其具体角色名称；从第二夜起，查验到纯白之女则其出局',
  action: '查验',
  resultTitle: '查验结果',
});

export const wolfWitch = defineRole({
  id: 'wolfWitch',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🧙🐺',
    description: COPY.description,
  },
  traits: {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
  },
  steps: [
    createSingleTargetStep({
      id: 'wolfWitchCheck',
      roleId: 'wolfWitch',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: false,
      targetUnavailableReason: getWolfTeammateRestriction,
      result: createIdentityCheckResult,
      renderResult: (context, result) =>
        renderIdentityCheckResult(context, result, COPY.resultTitle),
    }),
  ],
});
