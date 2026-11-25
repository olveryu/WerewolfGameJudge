import type { WerewolfRoleFaction } from './role';

/** A card as the deal sees it. */
export interface DealCard {
  readonly roleId: string;
  readonly faction: WerewolfRoleFaction;
}

/** The cards a role has set aside at the deal and chooses from at night. */
export interface BottomCardDeck {
  readonly size: number;
  /** Whether these cards may be set aside together. */
  readonly isLegal: (cards: readonly DealCard[]) => boolean;
  /**
   * Why a board can never supply a legal deck, told to whoever configures the board;
   * null when it can. `otherCards` is the board without this role's own card.
   */
  readonly boardRequirement?: (otherCards: readonly DealCard[]) => string | null;
  /** In plague mode this role's card is dealt as a villager and no deck is set aside. */
  readonly isRemovedInPlagueMode?: true;
}

export type PresenceEffect =
  | { readonly kind: 'disableFirstNightWolfAttack' }
  | { readonly kind: 'requireUnanimousWolfVote' }
  | { readonly kind: 'useBottomCardSelection'; readonly deck: BottomCardDeck }
  | { readonly kind: 'numberedAnnouncements'; readonly family: string };

export interface PresenceDeclaration<TRole extends string> {
  readonly role: TRole;
  readonly effect: PresenceEffect;
}

export interface NightPresenceFacts<TRole extends string> {
  /** The role whose presence stops the wolves from attacking on the first night. */
  readonly firstNightWolfAttackDisabledBy: TRole | null;
  readonly doesWolfVoteRequireUnanimity: boolean;
  /** The roles on the board that set cards aside, each with its deck rule. */
  readonly bottomCardDecks: readonly { readonly role: TRole; readonly deck: BottomCardDeck }[];
  readonly numberedAnnouncementRoles: Readonly<Record<string, readonly TRole[]>>;
}

export function resolveNightPresenceFacts<TRole extends string>(
  presentRoles: readonly TRole[],
  declarations: readonly PresenceDeclaration<TRole>[],
): NightPresenceFacts<TRole> {
  const present = new Set(presentRoles);
  let firstNightWolfAttackDisabledBy: TRole | null = null;
  let doesWolfVoteRequireUnanimity = false;
  const bottomCardDecks: { role: TRole; deck: BottomCardDeck }[] = [];
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
        bottomCardDecks.push({ role: declaration.role, deck: declaration.effect.deck });
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
    bottomCardDecks,
    numberedAnnouncementRoles,
  };
}
