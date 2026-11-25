import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';

const COPY = defineCopy({
  name: '咒狐',
  shortName: '狐',
  description:
    '独立第三方阵营；免疫狼人袭击；被预言家查验时直接出局，查验结果仍为好人；任一阵营达成胜利条件时若咒狐存活，则咒狐窃取胜利成为唯一赢家',
  passiveText: '独立第三方阵营；免疫狼人袭击',
  triggerText: '被预言家查验时直接出局，查验结果仍为好人',
  winConditionText: '任一阵营达成胜利条件时若咒狐存活，则咒狐窃取胜利成为唯一赢家',
});

export const cursedFox = createPassiveRole(
  'cursedFox',
  {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🦊',
    description: COPY.description,
    sections: {
      passive: COPY.passiveText,
      trigger: COPY.triggerText,
      winCondition: COPY.winConditionText,
    },
    tags: ['immune'],
  },
  {
    faction: 'special',
    team: 'third',
    checkReaction: 'targetDeath',
    immunities: ['wolfKill'],
  },
);
