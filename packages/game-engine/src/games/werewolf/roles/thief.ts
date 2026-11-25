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
  skillText: '首夜第一个行动；从法官手中的两张底牌中选择一张永久作为自身身份',
  passiveText: '被查验时以选择的身份为准',
  restrictionText: '底牌中有狼人阵营的牌时必须选择狼人',
  specialText: '未选中的底牌角色步骤照常进行但无人操作；底牌最多含一张狼人阵营的牌',
  action: '选择底牌',
  hasWolf: '底牌含狼人阵营',
  noWolf: '底牌均为好人阵营',
  resultTitle: '选择的身份',
});

export const thiefPresence = [
  { role: 'thief', effect: { kind: 'useBottomCardSelection' } },
] as const satisfies readonly PresenceDeclaration<'thief'>[];

export const thief = defineRole({
  id: 'thief',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: COPY.emoji,
    description: COPY.description,
    sections: {
      skill: COPY.skillText,
      passive: COPY.passiveText,
      restriction: COPY.restrictionText,
      special: COPY.specialText,
    },
    tags: ['transform'],
  },
  traits: { faction: 'special', team: 'good' },
  presence: thiefPresence[0],
  nightSchedule: 'firstNight',
  steps: [
    createCardSelectionStep({
      id: 'thiefChoose',
      roleId: 'thief',
      roleName: COPY.name,
      actionName: COPY.action,
      hint: (cards) => (cards.some((card) => card.faction === 'wolf') ? COPY.hasWolf : COPY.noWolf),
      resultTitle: COPY.resultTitle,
      identityChange: 'replaceCurrentRole',
      mustChooseWolfWhenAvailable: true,
    }),
  ],
});
