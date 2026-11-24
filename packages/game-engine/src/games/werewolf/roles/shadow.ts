import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createSingleTargetStep, getActingSeat } from './roleSteps';

const COPY = defineCopy({
  name: '影子',
  shortName: '影',
  description:
    '首夜模仿一名玩家；模仿目标出局后继承其身份和技能状态；模仿到复仇者时二人绑定；绑定后二人失去原技能，成为同生共死第三方；绑定后从第二夜起，每晚影子轮次二人睁眼，可袭击一名玩家；绑定后的袭击无视一切保护效果；非绑定时随继承的阵营胜利；绑定时胜利条件为屠城',
  action: '选择模仿对象',
});

export const shadow = defineRole({
  id: 'shadow',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🌑',
    description: COPY.description,
  },
  traits: { faction: 'special', team: 'third' },
  nightSchedule: 'firstNight',
  steps: [
    createSingleTargetStep({
      id: 'shadowChooseMimic',
      roleId: 'shadow',
      roleName: COPY.name,
      actionName: COPY.action,
      skippable: false,
      canTargetSelf: false,
      selectionEffects: (context, selection) => {
        const targetRole = context.role.roleOf(selection.landingSeat);
        const actorSeat = getActingSeat(context);
        return {
          disabledAbilities: [],
          deathEffects:
            targetRole === 'avenger'
              ? [
                  {
                    kind: 'link',
                    source: actorSeat,
                    from: actorSeat,
                    to: selection.landingSeat,
                    cause: 'bondedLink',
                    isMutual: true,
                  },
                ]
              : [],
        };
      },
    }),
  ],
});
