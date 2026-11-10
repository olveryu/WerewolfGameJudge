import { replayIntegration } from '@sentry/react';

/**
 * Builds the Session Replay integration. Kept in its own module so the bundler emits it as a
 * separate chunk that `instrument.ts` loads after start-up.
 *
 * @returns the replay integration with all text and inputs masked
 */
export function createReplayIntegration(): ReturnType<typeof replayIntegration> {
  return replayIntegration({ maskAllText: true, maskAllInputs: true });
}
