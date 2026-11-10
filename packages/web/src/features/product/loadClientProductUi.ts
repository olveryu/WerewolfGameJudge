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

let clientProductUi: Promise<ClientProductUi> | null = null;

/** The shared product UI; a failed load is not cached, so a remount retries. */
export function loadClientProductUi(): Promise<ClientProductUi> {
  if (clientProductUi === null) {
    const loading = loadGameProductUiContributions().then(createClientProductUi);
    loading.catch(() => {
      if (clientProductUi === loading) clientProductUi = null;
    });
    clientProductUi = loading;
  }
  return clientProductUi;
}
