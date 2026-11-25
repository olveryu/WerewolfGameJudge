import { defineCopy } from '../../../platform/steps';
import type { PresenceDeclaration } from './presence';
import { defineRole } from './role';
import {
  createFactionCheckResult,
  createSingleTargetStep,
  renderFactionCheckResult,
} from './roleSteps';

const COPY = defineCopy({
  name: '灯影预言家',
  shortName: '灯',
  description: '每晚可查验一名玩家的阵营，但结果与真实阵营相反；自身不知真实身份，以预言家身份示人',
  skillText: '每晚可查验一名玩家的阵营，但结果与真实阵营相反',
  passiveText: '自身不知真实身份，以预言家身份示人',
  action: '查验',
  resultTitle: '查验结果',
});

export const mirrorSeerPresence = [
  { role: 'mirrorSeer', effect: { kind: 'numberedAnnouncements', family: 'seerFamily' } },
] as const satisfies readonly PresenceDeclaration<'mirrorSeer'>[];

export const mirrorSeer = defineRole({
  id: 'mirrorSeer',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🪞',
    description: COPY.description,
    sections: { skill: COPY.skillText, passive: COPY.passiveText },
    tags: ['check'],
  },
  traits: { faction: 'villager', team: 'good', displayAs: 'seer' },
  presence: mirrorSeerPresence[0],
  steps: [
    createSingleTargetStep({
      id: 'mirrorSeerCheck',
      roleId: 'mirrorSeer',
      roleName: COPY.name,
      audioKey: 'seer',
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: false,
      result: (context, selection) => createFactionCheckResult(context, selection, 'invert'),
      renderResult: (_context, result) => renderFactionCheckResult(result, COPY.resultTitle),
    }),
  ],
});
