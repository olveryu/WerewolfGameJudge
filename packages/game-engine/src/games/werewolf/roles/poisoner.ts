import type { PresenceDeclaration } from './presence';

export const poisonerPresence = [
  { role: 'poisoner', effect: { kind: 'disableFirstNightWolfAttack' } },
] as const satisfies readonly PresenceDeclaration<'poisoner'>[];
