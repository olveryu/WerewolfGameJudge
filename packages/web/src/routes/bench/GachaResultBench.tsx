import { RARITIES, REWARD_POOL } from '@game-judge/game-engine/product/rewards';
import { Suspense, use } from 'react';

import type { DrawResultItem } from '@/features/gacha/services/gachaApi';
import { loadClientProductUi } from '@/features/product/loadClientProductUi';
import { TenResultOverlay } from '@/routes/gacha/components/TenResultOverlay';
import { TESTIDS } from '@/testids';

/** Shards a duplicate of each rarity awards in the fixture (any fixed numbers would do). */
const DUPLICATE_SHARDS = 5;

/**
 * A fixed ten-draw: two avatars of every rarity from the reward pool in its catalog order, the
 * second of each rarity a duplicate and the mythic one a pity hit. Avatars are still images, so
 * the result renders identically on every run.
 */
const FIXED_TEN_DRAW: readonly DrawResultItem[] = RARITIES.flatMap((rarity) =>
  REWARD_POOL.filter((item) => item.type === 'avatar' && item.rarity === rarity)
    .slice(0, 2)
    .map((item, index) => ({
      rarity,
      rewardType: item.type,
      rewardId: item.id,
      isNew: index === 0,
      isDuplicate: index === 1,
      isPityTriggered: rarity === 'mythic' && index === 0,
      shardsAwarded: index === 1 ? DUPLICATE_SHARDS : 0,
    })),
);

function GachaResultBenchContent() {
  const productUi = use(loadClientProductUi());
  return (
    <TenResultOverlay
      results={FIXED_TEN_DRAW}
      drawType="golden"
      productUi={productUi}
      onClose={() => {}}
    />
  );
}

/**
 * The gacha ten-draw result over fixed data, for the visual gate (`e2e/visual`): a real draw's
 * rewards are random, so the result dialog is photographed here, Storybook-style, from a fixture.
 */
export function GachaResultBench() {
  return (
    <main data-testid={TESTIDS.gachaResultBenchRoot}>
      <Suspense fallback={null}>
        <GachaResultBenchContent />
      </Suspense>
    </main>
  );
}
