import {
  DECRYPTO_REASONS,
  type DecryptoEffect,
  decryptoEngine,
  type DecryptoInternalCommand,
  type DecryptoState,
  DEFAULT_DECRYPTO_CONFIG,
} from '@game-judge/game-engine/games/decrypto/public';
import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { WorkerEffectContext } from '../../../platform/gameModules/workerModule';
import { handleDecryptoEffect } from '../effects';

const effect: Extract<DecryptoEffect, { type: 'decrypto.reveal.due' }> = {
  type: 'decrypto.reveal.due',
  payload: { gameSequence: 1, round: 1, team: 'blue', revealIndex: 0, revealAt: 2000 },
};

function createRejectedContext(
  reason: string,
): WorkerEffectContext<DecryptoState, DecryptoInternalCommand> {
  const state = decryptoEngine.createInitialState(DEFAULT_DECRYPTO_CONFIG, {
    roomCode: '4321',
    hostUserId: 'host',
    nowMs: 1000,
    commandId: 'create',
  });
  return {
    bindings: env,
    effectId: 'reveal-effect',
    state,
    roomIdentity: { roomId: 'room', roomCode: '4321', creationId: 'creation' },
    createdRevision: 1,
    deliveryAttemptCount: 1,
    dispatchInternal: (commandId) =>
      Promise.resolve(
        createRoomCommandResult({
          kind: 'rejected',
          commandId,
          reason,
        }),
      ),
    publishUserEvent: () => Promise.resolve(),
  };
}

describe('Decrypto reveal effect failures', () => {
  it.each([DECRYPTO_REASONS.phase, DECRYPTO_REASONS.stale])(
    'acknowledges a superseded delivery rejected as %s',
    async (reason) => {
      await expect(
        handleDecryptoEffect(effect, createRejectedContext(reason)),
      ).resolves.toBeUndefined();
    },
  );

  it('propagates a not-yet-due rejection to the outbox failure pipeline', async () => {
    await expect(
      handleDecryptoEffect(effect, createRejectedContext(DECRYPTO_REASONS.revealEarly)),
    ).rejects.toThrow(/Decrypto staged reveal command .* was rejected: decrypto_reveal_not_due/);
  });
});
