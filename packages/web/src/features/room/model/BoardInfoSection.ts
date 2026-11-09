/**
 * Shared data shape of the board info card: games build their sections in their room assembly
 * and `BoardInfoCard` renders them.
 */

/** One role entry of a board section. */
export interface RoleDisplayItem {
  readonly roleId: string;
  readonly displayName: string;
  readonly count: number;
}

/** One faction group of the board (e.g. 狼人); `color` is a CSS color value. */
export interface BoardInfoSection {
  readonly title: string;
  readonly items: readonly RoleDisplayItem[];
  readonly color: string;
}
