import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import {
  createIdentityCheckResult,
  createSingleTargetStep,
  renderIdentityCheckResult,
} from './roleSteps';

const COPY = defineCopy({
  name: '石像鬼',
  shortName: '石',
  description:
    '每晚可查验一名玩家的身份，获知其具体角色名称；与其他狼人互不相认；其他狼人全部出局后可主导袭击',
  action: '查验',
  resultTitle: '查验结果',
});

export const gargoyle = defineRole({
  id: 'gargoyle',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🗿',
    description: COPY.description,
  },
  traits: {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: false, participatesInWolfVote: false },
  },
  steps: [
    createSingleTargetStep({
      id: 'gargoyleCheck',
      roleId: 'gargoyle',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: false,
      result: createIdentityCheckResult,
      renderResult: (context, result) =>
        renderIdentityCheckResult(context, result, COPY.resultTitle),
    }),
  ],
});
