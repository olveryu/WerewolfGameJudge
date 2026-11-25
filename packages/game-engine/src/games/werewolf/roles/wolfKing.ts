import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';

const COPY = defineCopy({
  name: '白狼王',
  shortName: '白',
  description: '白天可自爆并带走一名玩家；非自爆出局时不能发动技能',
});

export const wolfKing = createPassiveRole(
  'wolfKing',
  { name: COPY.name, shortName: COPY.shortName, emoji: '👑🐺', description: COPY.description },
  {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
  },
);
