/**
 * nameStyles -- Name effect registry
 *
 * NameStyleId is derived from NAME_STYLE_IDS in `@werewolf/game-engine/growth/rewardCatalog`.
 * Use getNameStyleById to look up a config by id. Pattern follows `seatFlairs/index.ts`.
 */

import { NAME_STYLE_IDS } from '@werewolf/game-engine/growth/rewardCatalog';

import { NAME_STYLE_CONFIGS, type NameStyleConfig } from './nameStyleConfigs';

// NameStyleConfig intentionally not re-exported; consumers import from './nameStyleConfigs'
export { NameStyleText } from './NameStyleText';

/** All available name effects (order = NAME_STYLE_IDS display order) */
export const NAME_STYLES: readonly NameStyleConfig[] = NAME_STYLE_IDS.map(
  (id) => NAME_STYLE_CONFIGS[id],
);

const NAME_STYLE_MAP = new Map<string, NameStyleConfig>(NAME_STYLES.map((s) => [s.id, s]));

/** Get name effect config by id. Returns undefined for invalid id. */
export function getNameStyleById(id: string | null | undefined): NameStyleConfig | undefined {
  if (!id) return undefined;
  return NAME_STYLE_MAP.get(id);
}
