import type { PresenceDeclaration } from './presence';

export const treasureMasterPresence = [
  { role: 'treasureMaster', effect: { kind: 'useBottomCardSelection' } },
] as const satisfies readonly PresenceDeclaration<'treasureMaster'>[];
