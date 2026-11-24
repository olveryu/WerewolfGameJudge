import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep } from './roleSteps';

const COPY = defineCopy({
  name: '混血儿',
  shortName: '混',
  description: '首夜选择一名玩家作为榜样；与榜样同阵营，但不知道榜样的具体身份；与榜样阵营共同胜利',
  action: '选择榜样',
});

export const slacker = defineRole({
  id: 'slacker',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '😴',
    description: COPY.description,
  },
  traits: { faction: 'special', team: 'third' },
  nightSchedule: 'firstNight',
  steps: [
    createSingleTargetStep({
      id: 'slackerChooseIdol',
      roleId: 'slacker',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: false,
      canTargetSelf: false,
    }),
  ],
});
