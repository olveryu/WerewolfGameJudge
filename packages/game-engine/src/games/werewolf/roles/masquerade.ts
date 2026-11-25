import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';

const COPY = defineCopy({
  name: '假面',
  shortName: '假',
  description:
    '从第二夜起可查看一名玩家是否在舞池中，并可赐予一名玩家面具；被赐予面具的玩家共舞结算时阵营反转；与其他狼人互不相认；免疫女巫毒药；其他狼人全部出局后可主导袭击',
  skillText:
    '从第二夜起可查看一名玩家是否在舞池中，并可赐予一名玩家面具；被赐予面具的玩家共舞结算时阵营反转',
  passiveText: '与其他狼人互不相认；免疫女巫毒药',
  specialText: '其他狼人全部出局后可主导袭击',
});

export const masquerade = createPassiveRole(
  'masquerade',
  {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '🎭🐺',
    description: COPY.description,
    sections: { skill: COPY.skillText, passive: COPY.passiveText, special: COPY.specialText },
    tags: ['check', 'control', 'immune'],
  },
  {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: false, participatesInWolfVote: false, actsSolo: true },
    immunities: ['poison'],
  },
);
