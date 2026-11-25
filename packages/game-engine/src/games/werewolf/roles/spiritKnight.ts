import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';
import type { WerewolfRoleStepContext } from './role';

const COPY = defineCopy({
  name: '恶灵骑士',
  shortName: '灵',
  description: '永久免疫夜间伤害；被非狼人阵营角色查验或女巫毒杀时反伤，次日对方出局；不能自爆',
  passiveText: '永久免疫夜间伤害',
  triggerText: '被非狼人阵营角色查验或女巫毒杀时反伤，次日对方出局',
  restrictionText: '不能自爆',
});

export const spiritKnight = createPassiveRole(
  'spiritKnight',
  {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: '⚔️',
    description: COPY.description,
    sections: {
      passive: COPY.passiveText,
      trigger: COPY.triggerText,
      restriction: COPY.restrictionText,
    },
    tags: ['immune', 'link'],
  },
  {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    wolfKillTargetForbidden: true,
    checkReaction: 'reflect',
    immunities: ['nightDamage'],
  },
  (_context: WerewolfRoleStepContext, seat) => [
    { kind: 'reflect', seat, against: ['poison', 'checkDeath'] },
  ],
);
