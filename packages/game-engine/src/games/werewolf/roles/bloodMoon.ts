import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';

const COPY = defineCopy({
  name: '血月使徒',
  shortName: '血',
  description:
    '自爆后的当晚所有好人阵营的技能被封印；若为最后一个被放逐的狼人，可存活至下一个白天天亮后才出局',
});

export const bloodMoon = createPassiveRole(
  'bloodMoon',
  { name: COPY.name, shortName: COPY.shortName, emoji: '🩸', description: COPY.description },
  {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
  },
);
