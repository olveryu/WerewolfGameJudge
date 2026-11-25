import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';

const COPY = defineCopy({
  name: '守墓人',
  shortName: '墓',
  description: '每晚可得知上一个白天被放逐玩家的阵营（好人/狼人）',
});

export const graveyardKeeper = createPassiveRole(
  'graveyardKeeper',
  {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '⚰️',
    description: COPY.description,
    sections: { skill: COPY.description },
    tags: ['check'],
  },
  {
    faction: 'god',
    team: 'good',
  },
);
