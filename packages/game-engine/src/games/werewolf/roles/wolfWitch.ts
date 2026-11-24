import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import {
  createIdentityCheckResult,
  createSingleTargetStep,
  getActingSeat,
  renderIdentityCheckResult,
} from './roleSteps';

const COPY = defineCopy({
  name: '狼巫',
  shortName: '巫',
  description:
    '每晚可查验一名非狼人阵营玩家的身份，获知其具体角色名称；从第二夜起，查验到纯白之女则其出局',
  action: '查验',
  targetRestriction: '不能选择狼人阵营玩家',
  resultTitle: '狼巫查验结果',
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
      targetUnavailableReason: (context, seat) =>
        context.teamOfRole(context.role.roleOf(seat)) === 'wolf' ? COPY.targetRestriction : null,
      result: createIdentityCheckResult,
      renderResult: (context, result) =>
        renderIdentityCheckResult(context, result, COPY.resultTitle),
      selectionEffects: (context, selection) => ({
        disabledAbilities: [],
        deathEffects:
          context.state.nightNumber > 1 &&
          context.role.seenRole(selection.landingSeat) === 'pureWhite'
            ? [
                {
                  kind: 'attack',
                  cause: 'checkDeath',
                  source: getActingSeat(context),
                  target: selection.landingSeat,
                },
              ]
            : [],
      }),
    }),
  ],
});
