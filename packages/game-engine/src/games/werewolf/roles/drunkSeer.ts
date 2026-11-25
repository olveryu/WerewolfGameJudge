import { defineCopy } from '../../../platform/steps';
import type { PresenceDeclaration } from './presence';
import { defineRole } from './role';
import {
  createFactionCheckResult,
  createSingleTargetStep,
  renderFactionCheckResult,
} from './roleSteps';

const COPY = defineCopy({
  name: '酒鬼预言家',
  shortName: '酒',
  description:
    '每晚可查验一名玩家的阵营，但结果随机（50%正确/50%错误）；自身不知真实身份，以预言家身份示人',
  skillText: '每晚可查验一名玩家的阵营，但结果随机（50%正确/50%错误）',
  passiveText: '自身不知真实身份，以预言家身份示人',
  action: '查验',
  resultTitle: '查验结果',
});

export const drunkSeerPresence = [
  { role: 'drunkSeer', effect: { kind: 'numberedAnnouncements', family: 'seerFamily' } },
] as const satisfies readonly PresenceDeclaration<'drunkSeer'>[];

export const drunkSeer = defineRole({
  id: 'drunkSeer',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🍺🔮',
    description: COPY.description,
    sections: { skill: COPY.skillText, passive: COPY.passiveText },
    tags: ['check'],
  },
  traits: { faction: 'villager', team: 'good', displayAs: 'seer' },
  presence: drunkSeerPresence[0],
  steps: [
    createSingleTargetStep({
      id: 'drunkSeerCheck',
      roleId: 'drunkSeer',
      roleName: COPY.name,
      audioKey: 'seer',
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: false,
      result: (context, selection) => createFactionCheckResult(context, selection, 'random'),
      renderResult: (_context, result) => renderFactionCheckResult(result, COPY.resultTitle),
    }),
  ],
});
