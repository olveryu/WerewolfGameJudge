import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep, getActingSeat } from './roleSteps';

const COPY = defineCopy({
  name: '狼美人',
  shortName: '美',
  description:
    '每晚可魅惑一名玩家；被魅惑者不知情；出局时被魅惑者随之殉情出局；不能自爆；不能袭击自身',
  action: '魅惑',
});

export const wolfQueen = defineRole({
  id: 'wolfQueen',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '👸🐺',
    description: COPY.description,
  },
  traits: {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    immunities: ['wolfKill'],
  },
  steps: [
    createSingleTargetStep({
      id: 'wolfQueenCharm',
      roleId: 'wolfQueen',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: false,
      selectionEffects: (context, selection) => {
        const actorSeat = getActingSeat(context);
        return {
          disabledAbilities: [],
          deathEffects: [
            {
              kind: 'link',
              source: actorSeat,
              from: actorSeat,
              to: selection.landingSeat,
              cause: 'wolfQueenLink',
              isMutual: false,
            },
          ],
        };
      },
    }),
  ],
});
