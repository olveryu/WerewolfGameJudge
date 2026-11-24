import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep } from './roleSteps';

const COPY = defineCopy({
  name: '乌鸦',
  shortName: '鸦',
  description: '每晚可诅咒一名玩家，被诅咒者在次日白天放逐投票时额外增加一票',
  action: '诅咒',
});

export const crow = defineRole({
  id: 'crow',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🐦‍⬛',
    description: COPY.description,
  },
  traits: { faction: 'god', team: 'good' },
  steps: [
    createSingleTargetStep({
      id: 'crowCurse',
      roleId: 'crow',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: false,
    }),
  ],
});
