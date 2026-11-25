import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';

const COPY = defineCopy({
  name: '舞者',
  shortName: '舞',
  description:
    '从第二夜起，每晚必须选择三名玩家共舞（可含自身）；若三人分属不同阵营则人数少的一方出局；仅当自身参舞时，舞池中三人当夜免疫狼人袭击；免疫女巫毒药',
  skillText:
    '从第二夜起，每晚必须选择三名玩家共舞（可含自身）；若三人分属不同阵营则人数少的一方出局；仅当自身参舞时，舞池中三人当夜免疫狼人袭击',
  passiveText: '免疫女巫毒药',
});

export const dancer = createPassiveRole(
  'dancer',
  {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '💃',
    description: COPY.description,
    sections: { skill: COPY.skillText, passive: COPY.passiveText },
    tags: ['kill', 'protect', 'immune'],
  },
  {
    faction: 'god',
    team: 'good',
    immunities: ['poison'],
  },
);
