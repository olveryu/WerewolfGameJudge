import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';

const COPY = defineCopy({
  name: '猎魔人',
  shortName: '魔',
  description:
    '从第二夜起，每晚可选择一名玩家狩猎；对方是狼人则对方次日出局；对方是好人则自身次日出局；免疫女巫毒药',
  skillText:
    '从第二夜起，每晚可选择一名玩家狩猎；对方是狼人则对方次日出局；对方是好人则自身次日出局',
  passiveText: '免疫女巫毒药',
});

export const witcher = createPassiveRole(
  'witcher',
  {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🔪',
    description: COPY.description,
    sections: { skill: COPY.skillText, passive: COPY.passiveText },
    tags: ['kill', 'immune'],
  },
  {
    faction: 'god',
    team: 'good',
    immunities: ['poison'],
  },
);
