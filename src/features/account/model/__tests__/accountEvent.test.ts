/** SETTLE_RESULT decoding accepts every platform game type and stays strict otherwise. */

import { GAME_TYPES } from '@game-judge/game-engine/platform/protocol/gameTypes';

import { parseAccountEvent } from '@/features/account/model/accountEvent';

function buildSettleResult(gameType: string) {
  return {
    type: 'SETTLE_RESULT',
    eventId: 'settlement-1',
    gameType,
    settlementId: 'settlement-1',
    endedRevision: 12,
    xpEarned: 15,
    newXp: 40,
    newLevel: 2,
    previousLevel: 1,
    normalDrawsEarned: 2,
    goldenDrawsEarned: 1,
  };
}

describe('parseAccountEvent', () => {
  it.each(GAME_TYPES)('decodes a SETTLE_RESULT for %s', (gameType) => {
    const message = buildSettleResult(gameType);
    expect(parseAccountEvent(message)).toEqual(message);
  });

  it('rejects an unknown gameType', () => {
    expect(() => parseAccountEvent(buildSettleResult('unknown'))).toThrow(
      'SETTLE_RESULT gameType is invalid: unknown',
    );
  });

  it('rejects a missing field', () => {
    const message: Record<string, unknown> = buildSettleResult('werewolf');
    delete message['newXp'];
    expect(() => parseAccountEvent(message)).toThrow('SETTLE_RESULT is missing field: newXp');
  });

  it('rejects an unknown extra field', () => {
    const message = { ...buildSettleResult('werewolf'), bonus: 1 };
    expect(() => parseAccountEvent(message)).toThrow('SETTLE_RESULT contains unknown field: bonus');
  });
});
