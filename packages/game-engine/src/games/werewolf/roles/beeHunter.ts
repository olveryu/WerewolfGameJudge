import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';

const COPY = defineCopy({
  name: '蜂之狂猎',
  shortName: '蜂',
  description:
    '第二晚起每晚可蜂刺两名不同玩家，不能选择自己；两名狼人同时出局，一狼一好人没有效果，两名好人则永久失去技能，并于下一晚使用时获知；不同夜可以重复选择同一对玩家；蜂刺不能被守卫挡住',
  skillText: '第二晚起每晚可蜂刺两名不同玩家，不能选择自己',
  triggerText: '两名狼人同时出局，一狼一好人没有效果，两名好人则永久失去技能，并于下一晚使用时获知',
  specialText: '不同夜可以重复选择同一对玩家；蜂刺不能被守卫挡住',
});

export const beeHunter = defineRole({
  id: 'beeHunter',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🐝',
    description: COPY.description,
    sections: {
      skill: COPY.skillText,
      trigger: COPY.triggerText,
      special: COPY.specialText,
    },
    tags: ['kill'],
  },
  traits: { faction: 'god', team: 'good' },
  steps: [],
});
