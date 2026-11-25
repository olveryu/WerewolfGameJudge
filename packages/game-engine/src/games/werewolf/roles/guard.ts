import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep, getActingSeat } from './roleSteps';

const COPY = defineCopy({
  name: '守卫',
  shortName: '守',
  description:
    '每晚可守护一名玩家使其免受狼人袭击；不能连续两晚守护同一人；守护无法防御女巫毒药；同时被守护和解药救活的玩家仍然出局',
  skillText: '每晚可守护一名玩家使其免受狼人袭击',
  restrictionText: '不能连续两晚守护同一人；守护无法防御女巫毒药',
  specialText: '同时被守护和解药救活的玩家仍然出局',
  action: '守护',
});

export const guard = defineRole({
  id: 'guard',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🛡️',
    description: COPY.description,
    sections: {
      skill: COPY.skillText,
      restriction: COPY.restrictionText,
      special: COPY.specialText,
    },
    tags: ['protect'],
  },
  traits: { faction: 'god', team: 'good' },
  steps: [
    createSingleTargetStep({
      id: 'guardProtect',
      roleId: 'guard',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: true,
      selectionEffects: (_context, selection) => ({
        disabledAbilities: [],
        deathEffects: [
          {
            kind: 'protect',
            source: getActingSeat(_context),
            target: selection.landingSeat,
            against: ['wolfKill'],
            conflictGroup: 'wolfSave',
          },
        ],
      }),
    }),
  ],
});
