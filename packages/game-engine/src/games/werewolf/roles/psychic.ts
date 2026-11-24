import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import {
  createIdentityCheckResult,
  createSingleTargetStep,
  renderIdentityCheckResult,
} from './roleSteps';

const COPY = defineCopy({
  name: '通灵师',
  shortName: '通',
  description: '每晚可查验一名玩家的身份，获知其具体角色名称',
  action: '通灵',
  resultTitle: '通灵结果',
});

export const psychic = defineRole({
  id: 'psychic',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '👁️',
    description: COPY.description,
  },
  traits: { faction: 'god', team: 'good' },
  steps: [
    createSingleTargetStep({
      id: 'psychicCheck',
      roleId: 'psychic',
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
