import type { PresenceDeclaration } from './presence';

export const seerPresence = [
  { role: 'seer', effect: { kind: 'numberedAnnouncements', family: 'seerFamily' } },
] as const satisfies readonly PresenceDeclaration<'seer'>[];
