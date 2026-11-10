/**
 * The client product UI, composed once from the games' lazily loaded contributions. Replaces the
 * previous client's React context: game slices may not provide context, so product pages read
 * this cached promise with `use()` under Suspense.
 */
import {
  type ClientProductUi,
  createClientProductUi,
} from '@/features/product/model/ClientProductUi';
import { loadGameProductUiContributions } from '@/games/productUiCatalog';
import { cacheLoad } from '@/utils/cacheLoad';

/** The shared product UI; a failed load is not cached, so a remount retries. */
export const loadClientProductUi: () => Promise<ClientProductUi> = cacheLoad(async () =>
  createClientProductUi(await loadGameProductUiContributions()),
);
