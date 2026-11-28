/**
 * Shared data shape of the board info card: games build their sections in their room assembly
 * and `BoardInfoCard` renders them.
 */

import type { BadgeTone } from '@/components/Badge';

/** One role entry of a board section. */
export interface RoleDisplayItem {
  readonly roleId: string;
  readonly displayName: string;
  readonly count: number;
}

/** One faction group of the board (e.g. 狼人), drawn in its badge tone. */
export interface BoardInfoSection {
  readonly title: string;
  readonly items: readonly RoleDisplayItem[];
  readonly tone: BadgeTone;
}
