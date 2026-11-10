import type { Rarity } from '@game-judge/game-engine/product/rewards';

import { getRarityCellConfig } from '@/config/rarityVisual';

/**
 * A grid cell's rarity tint: a top-to-bottom gradient behind the cell's content, rare and
 * better only. The cell must be positioned; renders nothing for common and unrated items.
 */
export function RarityCellBg({ rarity }: { readonly rarity: Rarity | null }) {
  const config = getRarityCellConfig(rarity);
  if (config === null) return null;
  const [top, bottom] = config.gradient;
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        borderRadius: 'inherit',
        background: `linear-gradient(${top}, ${bottom})`,
      }}
    />
  );
}
