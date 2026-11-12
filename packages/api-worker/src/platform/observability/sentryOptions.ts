import type { CloudflareOptions } from '@sentry/cloudflare';

import type { Env } from '../../env';

/** Keeps collection explicit and clients isolated across SDK v11 invocations. */
export function createSentryOptions(
  env: Pick<Env, 'SENTRY_DSN' | 'ENVIRONMENT'>,
  collectUserInfo = false,
): CloudflareOptions {
  const restrictedFields = ['forwarded', '-ip', 'remote-', 'via', '-user'];

  return {
    dsn: env.SENTRY_DSN,
    tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.2 : 1.0,
    environment: env.ENVIRONMENT,
    cacheClient: false,
    traceLifecycle: 'static',
    attachStacktrace: false,
    dataCollection: {
      userInfo: collectUserInfo,
      cookies: false,
      httpHeaders: collectUserInfo
        ? true
        : {
            request: { deny: restrictedFields },
            response: { deny: restrictedFields },
          },
      httpBodies: [],
      urlQueryParams: collectUserInfo ? true : { deny: restrictedFields },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      graphQL: { document: false, variables: false },
      frameContextLines: 7,
    },
  };
}
