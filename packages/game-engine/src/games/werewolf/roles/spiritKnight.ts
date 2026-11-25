import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';
import type { WerewolfRoleStepContext } from './role';

const COPY = defineCopy({
  name: '恶灵骑士',
  shortName: '灵',
  description: '永久免疫夜间伤害；被非狼人阵营角色查验或女巫毒杀时反伤，次日对方出局；不能自爆',
});

export const spiritKnight = createPassiveRole(
  'spiritKnight',
  { name: COPY.name, shortName: COPY.shortName, emoji: '⚔️', description: COPY.description },
  {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    wolfKillTargetForbidden: true,
    checkReaction: 'reflect',
    immunities: ['wolfKill', 'poison', 'checkDeath'],
  },
  (_context: WerewolfRoleStepContext, seat) => [
    { kind: 'reflect', seat, against: ['poison', 'checkDeath'] },
  ],
);
