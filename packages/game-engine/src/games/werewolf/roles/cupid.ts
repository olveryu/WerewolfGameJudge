import type { PresenceDeclaration } from './presence';

export const cupidPresence = [
  { role: 'cupid', effect: { kind: 'requireUnanimousWolfVote' } },
] as const satisfies readonly PresenceDeclaration<'cupid'>[];
