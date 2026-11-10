/**
 * Encyclopedia data-source contract: the shared encyclopedia only knows these shapes, and each
 * game adapts its own role data (engine specs, client meta) into them.
 *
 * `tags` and `tagCatalog` are optional: without a `tagCatalog` the encyclopedia shows no ability
 * filter and entries show no tag chips.
 */
import type { DescriptionField } from '@/features/room/model/RevealRoleData';

/** Faction palette key; `Encyclopedia.css` maps it to the color and its tints. */
export type EncyclopediaFactionColorKey = 'wolf' | 'god' | 'villager' | 'third';

/** Tag palette key; `Encyclopedia.css` maps it to the color and its chip tint. */
export type EncyclopediaTagColorKey =
  | EncyclopediaFactionColorKey
  | 'info'
  | 'success'
  | 'error'
  | 'warning'
  | 'primaryLight'
  | 'textSecondary'
  | 'textMuted';

/** One ability tag, translated by the game binding from its own tag system. */
export interface EncyclopediaRoleTag {
  readonly key: string;
  readonly label: string;
  readonly colorKey: EncyclopediaTagColorKey;
}

/** Faction group: order and headers of the "all" view, and the faction filter tabs. */
export interface EncyclopediaFactionGroup {
  readonly key: string;
  readonly label: string;
  readonly colorKey: EncyclopediaFactionColorKey;
}

/** One role entry; the binding prepares every display field up front. */
export interface EncyclopediaRoleEntry {
  readonly id: string;
  readonly displayName: string;
  /** Detail subtitle (e.g. the English name). */
  readonly subtitle?: string;
  /** Faction group key (one of `factionGroups`). */
  readonly factionKey: string;
  /** Faction chip text of the detail hero. */
  readonly factionLabel: string;
  readonly factionColorKey: EncyclopediaFactionColorKey;
  /** One-line description: the detail text when there are no structured fields. */
  readonly description?: string;
  /** Search haystack (names, aliases, full description). */
  readonly searchText: string;
  readonly structuredFields: readonly DescriptionField[];
  readonly tags?: readonly EncyclopediaRoleTag[];
  /** List card image URL. */
  readonly listImage?: string;
  /** Detail hero image URL. */
  readonly detailImage?: string;
}

/** One game's complete encyclopedia data source. */
export interface EncyclopediaRoleSource {
  readonly roles: readonly EncyclopediaRoleEntry[];
  readonly factionGroups: readonly EncyclopediaFactionGroup[];
  /** Ability tag catalog for the filter; absent means this game has no tag filter. */
  readonly tagCatalog?: readonly EncyclopediaRoleTag[];
}
