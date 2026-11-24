import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import {
  createIdentityCheckResult,
  createSingleTargetStep,
  getActingSeat,
  renderIdentityCheckResult,
} from './roleSteps';

const COPY = defineCopy({
  name: '纯白之女',
  shortName: '纯',
  description: '每晚可查验一名玩家的身份，获知其具体角色名称；从第二夜起，查验到狼人则该狼人出局',
  action: '查验',
  resultTitle: '纯白查验结果',
});

export const pureWhite = defineRole({
  id: 'pureWhite',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🤍',
    description: COPY.description,
  },
  traits: { faction: 'god', team: 'good' },
  steps: [
    createSingleTargetStep({
      id: 'pureWhiteCheck',
      roleId: 'pureWhite',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: false,
      result: createIdentityCheckResult,
      renderResult: (context, result) =>
        renderIdentityCheckResult(context, result, COPY.resultTitle),
      selectionEffects: (context, selection) => {
        const roleId = context.role.seenRole(selection.landingSeat);
        const isNightKill = context.state.nightNumber > 1 && context.teamOfRole(roleId) === 'wolf';
        return {
          disabledAbilities: [],
          deathEffects: isNightKill
            ? [
                {
                  kind: 'attack',
                  cause: 'checkDeath',
                  source: getActingSeat(context),
                  target: selection.landingSeat,
                },
              ]
            : [],
        };
      },
    }),
  ],
});
