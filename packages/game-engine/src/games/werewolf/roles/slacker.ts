import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep, formatIdolSelection, IDOL_ACTION_COPY } from './roleSteps';

const COPY = defineCopy({
  name: '混血儿',
  shortName: '混',
  description: '首夜选择一名玩家作为榜样；与榜样同阵营，但不知道榜样的具体身份；与榜样阵营共同胜利',
  skillText: '首夜选择一名玩家作为榜样；与榜样同阵营，但不知道榜样的具体身份',
  winConditionText: '与榜样阵营共同胜利',
  ruleHint: '你将与榜样同阵营',
});

export const slacker = defineRole({
  id: 'slacker',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '😴',
    description: COPY.description,
    sections: { skill: COPY.skillText, winCondition: COPY.winConditionText },
    tags: ['follow'],
  },
  traits: { faction: 'special', team: 'third' },
  steps: [
    createSingleTargetStep({
      id: 'slackerChooseIdol',
      roleId: 'slacker',
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
