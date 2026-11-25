import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';

const COPY = defineCopy({
  name: '典狱长',
  shortName: '狱',
  description:
    '从第二夜起，每晚选择两名玩家进行交易，随后与狼人共同袭击；双方得知对象但不知身份，各自选「交易」或「背叛」；每人限交易一次；双方同选「交易」则免夜间伤害；双方同选「背叛」则互为当夜技能目标；一人选「交易」、另一人选「背叛」则选「交易」的玩家出局；选自身交易时，对方与自身同选则自身出局，不同则对方出局',
});

export const warden = createPassiveRole(
  'warden',
  { name: COPY.name, shortName: COPY.shortName, emoji: '⛓️', description: COPY.description },
  {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
  },
);
