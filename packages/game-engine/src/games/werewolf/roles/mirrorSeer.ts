import type { PresenceDeclaration } from './presence';

export const mirrorSeerPresence = [
  { role: 'mirrorSeer', effect: { kind: 'numberedAnnouncements', family: 'seerFamily' } },
] as const satisfies readonly PresenceDeclaration<'mirrorSeer'>[];
