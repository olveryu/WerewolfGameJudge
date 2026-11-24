import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep, getActingSeat } from './roleSteps';

const COPY = defineCopy({
  name: '摄梦人',
  shortName: '摄',
  description:
    '每晚可选择一名玩家成为梦游者；梦游者不知情且免疫夜间伤害；自身夜间出局则梦游者一并出局；同一名玩家连续两晚被摄梦则出局',
  action: '摄梦',
});

export const dreamcatcher = defineRole({
  id: 'dreamcatcher',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🌙',
    description: COPY.description,
  },
  traits: { faction: 'god', team: 'good' },
  steps: [
    createSingleTargetStep({
      id: 'dreamcatcherDream',
      roleId: 'dreamcatcher',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: true,
      canTargetSelf: false,
      selectionEffects: (context, selection) => {
        const actorSeat = getActingSeat(context);
        const targetWasDreamedLastNight = context.state.previousTargets.some(
          (target) =>
            target.roleId === 'dreamcatcher' &&
            target.actorSeat === actorSeat &&
            target.targetSeat === selection.landingSeat,
        );
        return {
          disabledAbilities: [],
          deathEffects: [
            {
              kind: 'link',
              source: actorSeat,
              from: actorSeat,
              to: selection.landingSeat,
              cause: 'dreamcatcherLink',
              isMutual: false,
              bypassShelter: true,
            },
            ...(targetWasDreamedLastNight
              ? [
                  {
                    kind: 'attack' as const,
                    cause: 'checkDeath' as const,
                    source: actorSeat,
                    target: selection.landingSeat,
                  },
                ]
              : [
                  {
                    kind: 'shelter' as const,
                    source: actorSeat,
                    target: selection.landingSeat,
                  },
                ]),
          ],
        };
      },
    }),
  ],
});
