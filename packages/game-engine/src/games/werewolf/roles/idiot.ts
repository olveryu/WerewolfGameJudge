import { defineCopy } from '../../../platform/steps';
import { createPassiveRole } from './passiveRole';

const COPY = defineCopy({
  name: '愚者',
  shortName: '愚',
  description: '被投票放逐时可翻牌免死；翻牌后失去投票权和技能使用权',
});

export const idiot = createPassiveRole(
  'idiot',
  { name: COPY.name, shortName: COPY.shortName, emoji: '🤡', description: COPY.description },
  { faction: 'god', team: 'good' },
);
