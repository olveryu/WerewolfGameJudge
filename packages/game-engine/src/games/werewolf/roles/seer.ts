import { defineCopy } from '../../../platform/steps';
import type { PresenceDeclaration } from './presence';
import { defineRole } from './role';
import {
  createCheckEffects,
  createFactionCheckResult,
  createSingleTargetStep,
  renderFactionCheckResult,
} from './roleSteps';

const COPY = defineCopy({
  name: '预言家',
  shortName: '预',
  description: '每晚可查验一名玩家的阵营，获知其是好人还是狼人',
  action: '查验',
  resultTitle: '查验结果',
});

export const seerPresence = [
  { role: 'seer', effect: { kind: 'numberedAnnouncements', family: 'seerFamily' } },
] as const satisfies readonly PresenceDeclaration<'seer'>[];

export const seer = defineRole({
  id: 'seer',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🔮',
    description: COPY.description,
    sections: { skill: COPY.description },
    tags: ['check'],
  },
  traits: { faction: 'god', team: 'good' },
  presence: seerPresence[0],
  steps: [
    createSingleTargetStep({
      id: 'seerCheck',
      roleId: 'seer',
      roleName: COPY.name,
      audioKey: 'seer',
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: false,
      selectionEffects: createCheckEffects,
      result: (context, selection) => createFactionCheckResult(context, selection, 'identity'),
      renderResult: (_context, result) => renderFactionCheckResult(result, COPY.resultTitle),
    }),
  ],
});
