export type PresenceEffect =
  | { readonly kind: 'disableFirstNightWolfAttack' }
  | { readonly kind: 'requireUnanimousWolfVote' }
  | { readonly kind: 'useBottomCardSelection' }
  | { readonly kind: 'numberedAnnouncements'; readonly family: string };

export interface PresenceDeclaration<TRole extends string> {
  readonly role: TRole;
  readonly effect: PresenceEffect;
}

export interface NightPresenceFacts<TRole extends string> {
  /** The role whose presence stops the wolves from attacking on the first night. */
  readonly firstNightWolfAttackDisabledBy: TRole | null;
  readonly doesWolfVoteRequireUnanimity: boolean;
  readonly bottomCardRoles: readonly TRole[];
  readonly numberedAnnouncementRoles: Readonly<Record<string, readonly TRole[]>>;
}

export function resolveNightPresenceFacts<TRole extends string>(
  presentRoles: readonly TRole[],
  declarations: readonly PresenceDeclaration<TRole>[],
): NightPresenceFacts<TRole> {
  const present = new Set(presentRoles);
  let firstNightWolfAttackDisabledBy: TRole | null = null;
  let doesWolfVoteRequireUnanimity = false;
  const bottomCardRoles: TRole[] = [];
  const numberedAnnouncementRoles: Record<string, TRole[]> = {};

  for (const declaration of declarations) {
    if (!present.has(declaration.role)) continue;
    switch (declaration.effect.kind) {
      case 'disableFirstNightWolfAttack':
        firstNightWolfAttackDisabledBy ??= declaration.role;
        break;
      case 'requireUnanimousWolfVote':
        doesWolfVoteRequireUnanimity = true;
        break;
      case 'useBottomCardSelection':
        bottomCardRoles.push(declaration.role);
        break;
      case 'numberedAnnouncements': {
        const family = numberedAnnouncementRoles[declaration.effect.family] ?? [];
        family.push(declaration.role);
        numberedAnnouncementRoles[declaration.effect.family] = family;
        break;
      }
    }
  }

  return {
    firstNightWolfAttackDisabledBy,
    doesWolfVoteRequireUnanimity,
    bottomCardRoles,
    numberedAnnouncementRoles,
  };
}
