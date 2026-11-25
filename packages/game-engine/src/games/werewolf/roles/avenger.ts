import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';
import { createViewStep, getActingSeat } from './viewStep';

const COPY = defineCopy({
  name: '复仇者',
  shortName: '仇',
  description:
    '首夜获知自身阵营；永远与影子模仿目标阵营对立；预言家查验为好人；非绑定时出局可刺杀一名玩家；刺杀不受毒杀影响；刺杀命中敌方有效、己方无效；刺杀命中未变身影子则单独胜利；若影子模仿复仇者则二人绑定；绑定后二人失去原技能，成为同生共死第三方；绑定后从第二夜起，每晚影子轮次二人睁眼，可袭击一名玩家；绑定后的袭击无视一切保护效果；帮好人时算神职；帮狼时与其他狼人互不相认；帮狼时其他狼人全部出局后可主导袭击；非绑定时随自身阵营胜利；绑定时胜利条件为屠城',
  skillText: '首夜获知自身阵营',
  passiveText: '永远与影子模仿目标阵营对立；预言家查验为好人',
  triggerText:
    '非绑定时出局可刺杀一名玩家；刺杀不受毒杀影响；刺杀命中敌方有效、己方无效；刺杀命中未变身影子则单独胜利',
  specialText:
    '若影子模仿复仇者则二人绑定；绑定后二人失去原技能，成为同生共死第三方；绑定后从第二夜起，每晚影子轮次二人睁眼，可袭击一名玩家；绑定后的袭击无视一切保护效果；帮好人时算神职；帮狼时与其他狼人互不相认；帮狼时其他狼人全部出局后可主导袭击',
  winConditionText: '非绑定时随自身阵营胜利；绑定时胜利条件为屠城',
  stepTitle: '阵营确认',
  viewTitle: '阵营',
  good: '你属于好人阵营',
  wolf: '你属于狼人阵营',
  bonded: '你与影子绑定，同属第三方阵营',
  confirmed: '已确认阵营',
});

export const avenger = defineRole({
  id: 'avenger',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '⚔️',
    description: COPY.description,
    sections: {
      skill: COPY.skillText,
      passive: COPY.passiveText,
      trigger: COPY.triggerText,
      special: COPY.specialText,
      winCondition: COPY.winConditionText,
    },
    tags: ['kill', 'link'],
  },
  traits: { faction: 'special', team: 'third' },
  nightSchedule: 'firstNight',
  steps: [
    createViewStep({
      id: 'avengerConfirm',
      roleId: 'avenger',
      roleName: COPY.name,
      stepTitle: COPY.stepTitle,
      viewTitle: COPY.viewTitle,
      reviewPhrase: () => COPY.confirmed,
      content: (context) => {
        switch (context.avengerFactionOf(getActingSeat(context))) {
          case 'good':
            return COPY.good;
          case 'wolf':
            return COPY.wolf;
          case 'bonded':
            return COPY.bonded;
        }
      },
    }),
  ],
});
