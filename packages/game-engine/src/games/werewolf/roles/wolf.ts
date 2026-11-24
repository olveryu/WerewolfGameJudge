import { defineCopy } from '../../../platform/steps';
import { defineRole } from './role';

const COPY = defineCopy({
  name: '狼人',
  shortName: '狼',
  emoji: '🐺',
  description: '每晚与狼队友共同选择一名玩家进行袭击',
});

export const wolf = defineRole({
  id: 'wolf',
  card: {
    name: COPY.name,
    shortName: COPY.shortName,
    emoji: COPY.emoji,
    description: COPY.description,
  },
  traits: {
    faction: 'wolf',
    team: 'wolf',
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
  },
  steps: [],
});
