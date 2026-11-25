import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';

const COPY = defineCopy({
  name: '骑士',
  shortName: '骑',
  description: '白天可翻牌与一名玩家决斗；对方是狼人则对方出局；对方是好人则自身出局',
});

export const knight = createPassiveRole(
  'knight',
  { name: COPY.name, shortName: COPY.shortName, emoji: '🗡️', description: COPY.description },
  { faction: 'god', team: 'good' },
);
