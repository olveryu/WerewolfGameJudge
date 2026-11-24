import type { PresenceDeclaration } from './presence';

export const thiefPresence = [
  { role: 'thief', effect: { kind: 'useBottomCardSelection' } },
] as const satisfies readonly PresenceDeclaration<'thief'>[];
