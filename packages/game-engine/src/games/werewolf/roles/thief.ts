import { defineCopy } from '../../../platform/steps';
import type { PresenceDeclaration } from './presence';
import { defineRole } from './role';
import { createCardSelectionStep } from './roleSteps';

const COPY = defineCopy({
  name: '盗贼',
  shortName: '窃',
  emoji: '🃏',
  description:
    '首夜第一个行动；从法官手中的两张底牌中选择一张永久作为自身身份；被查验时以选择的身份为准；底牌中有狼人阵营的牌时必须选择狼人；未选中的底牌角色步骤照常进行但无人操作；底牌最多含一张狼人阵营的牌',
  action: '盗取',
  prompt: '请选择一张底牌作为你的身份',
  resultTitle: '选择的身份',
});

export const thiefPresence = [
  { role: 'thief', effect: { kind: 'useBottomCardSelection' } },
] as const satisfies readonly PresenceDeclaration<'thief'>[];

export const thief = defineRole({
  id: 'thief',
  card: COPY,
  traits: { faction: 'special', team: 'good' },
  presence: thiefPresence[0],
  nightSchedule: 'firstNight',
  steps: [
    createCardSelectionStep({
      id: 'thiefChoose',
      roleId: 'thief',
      roleName: COPY.name,
      actionName: COPY.action,
      prompt: COPY.prompt,
      resultTitle: COPY.resultTitle,
      identityChange: 'replaceCurrentRole',
      mustChooseWolfWhenAvailable: true,
    }),
  ],
});
