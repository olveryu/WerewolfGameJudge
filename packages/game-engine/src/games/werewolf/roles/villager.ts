import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';

const COPY = defineCopy({
  name: '平民',
  shortName: '民',
  description: '没有特殊技能，依靠推理和投票帮助好人阵营获胜',
});

export const villager = createPassiveRole(
  'villager',
  { name: COPY.name, shortName: COPY.shortName, emoji: '👤', description: COPY.description },
  {
    faction: 'villager',
    team: 'good',
  },
);
