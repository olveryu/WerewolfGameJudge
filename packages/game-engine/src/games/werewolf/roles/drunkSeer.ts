import type { PresenceDeclaration } from './presence';

export const drunkSeerPresence = [
  { role: 'drunkSeer', effect: { kind: 'numberedAnnouncements', family: 'seerFamily' } },
] as const satisfies readonly PresenceDeclaration<'drunkSeer'>[];
