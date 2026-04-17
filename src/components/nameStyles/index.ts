/**
 * nameStyles — 名字特效注册表
 *
 * NameStyleId 类型从 `@werewolf/game-engine/growth/rewardCatalog` 的 NAME_STYLE_IDS 派生。
 * 通过 getNameStyleById 按 id 获取配置。pattern 同 `seatFlairs/index.ts`。
 */

import { NAME_STYLE_IDS, type NameStyleId } from '@werewolf/game-engine/growth/rewardCatalog';

import { NAME_STYLE_CONFIGS, type NameStyleConfig, type NameStyleTier } from './nameStyleConfigs';

export type { NameStyleConfig, NameStyleId, NameStyleTier };
export { NameStyleText } from './NameStyleText';

/** 所有可用名字特效（顺序 = NAME_STYLE_IDS 展示顺序） */
export const NAME_STYLES: readonly NameStyleConfig[] = NAME_STYLE_IDS.map(
  (id) => NAME_STYLE_CONFIGS[id],
);

const NAME_STYLE_MAP = new Map<string, NameStyleConfig>(NAME_STYLES.map((s) => [s.id, s]));

/** 按 id 获取名字特效配置。无效 id 返回 undefined。 */
export function getNameStyleById(id: string | null | undefined): NameStyleConfig | undefined {
  if (!id) return undefined;
  return NAME_STYLE_MAP.get(id);
}
