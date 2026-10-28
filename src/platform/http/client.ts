/** Composition root for the application's single `ApiClient` and its token store. */
import { API_BASE_URL, API_TIMEOUT_MS, FETCH_RETRY_BASE_MS, FETCH_RETRY_COUNT } from '@/config/api';
import { AuthTokenStore } from '@/platform/auth/AuthTokenStore';
import { storage } from '@/services/infra/localStorage';
import { apiLog } from '@/utils/logger';

import { ApiClient } from './ApiClient';

export const authTokenStore = new AuthTokenStore(storage);

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  defaultTimeoutMs: API_TIMEOUT_MS,
  networkRetry: { attempts: FETCH_RETRY_COUNT, baseDelayMs: FETCH_RETRY_BASE_MS },
  tokens: authTokenStore,
  fetch: (input, init) => fetch(input, init),
  logger: apiLog,
});
