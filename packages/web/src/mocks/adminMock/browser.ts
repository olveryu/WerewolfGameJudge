import { setupWorker } from 'msw/browser';

import { adminMockHandlers } from './handlers';

const worker = setupWorker(...adminMockHandlers);

/** Start the opt-in local admin API before the application mounts its first query. */
export async function startAdminMockWorker(): Promise<void> {
  await worker.start({
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}
