import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep, formatIdolSelection, IDOL_ACTION_COPY } from './roleSteps';

const COPY = defineCopy({
  name: '野孩子',
  shortName: '野',
  description:
    '首夜选择一名玩家作为榜样；榜样被投票放逐时自身变为狼人；若先于榜样出局则始终为好人阵营；未变身时随好人阵营胜利；变为狼人后随狼人阵营胜利',
  skillText: '首夜选择一名玩家作为榜样',
  triggerText: '榜样被投票放逐时自身变为狼人；若先于榜样出局则始终为好人阵营',
  winConditionText: '未变身时随好人阵营胜利；变为狼人后随狼人阵营胜利',
  ruleHint: '榜样被投票出局时你将变为狼人',
});

export const wildChild = defineRole({
  id: 'wildChild',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '👶',
    description: COPY.description,
    sections: {
      skill: COPY.skillText,
      trigger: COPY.triggerText,
      winCondition: COPY.winConditionText,
    },
    tags: ['transform', 'link'],
  },
  traits: { faction: 'special', team: 'third' },
  nightSchedule: 'firstNight',
  steps: [
    createSingleTargetStep({
      id: 'wildChildChooseIdol',
      roleId: 'wildChild',
      roleName: COPY.name,
      actionName: IDOL_ACTION_COPY.action,
      prompt: IDOL_ACTION_COPY.prompt,
      phrase: formatIdolSelection,
      ruleHints: () => [COPY.ruleHint],
      skippable: false,
      canTargetSelf: false,
    }),
  ],
});
