import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';

const COPY = defineCopy({
  name: '定序王子',
  shortName: '序',
  description:
    '每个白天第一次放逐投票结束后可选择翻牌发动技能；若翻牌则逆转时空回到本次投票前重新投票；重新投票前可额外发言一次；每局限用一次',
});

export const sequencePrince = createPassiveRole(
  'sequencePrince',
  { name: COPY.name, shortName: COPY.shortName, emoji: '⏮️', description: COPY.description },
  {
    faction: 'god',
    team: 'good',
  },
);
