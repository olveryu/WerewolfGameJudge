/** State parsing round-trips the current shape and rejects foreign game identity. */

import { decryptoEngine } from '../engine';
import { parseDecryptoState } from '../state/parseState';
import { DEFAULT_DECRYPTO_CONFIG } from '../state/types';

describe('Decrypto state parser', () => {
  it('accepts a lobby state unchanged', () => {
    const state = decryptoEngine.createInitialState(
      { ...DEFAULT_DECRYPTO_CONFIG },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    const persisted = JSON.parse(JSON.stringify(state)) as unknown;
    expect(parseDecryptoState(persisted)).toEqual(state);
  });

  it('rejects a state carrying another game identity', () => {
    const state = decryptoEngine.createInitialState(
      { ...DEFAULT_DECRYPTO_CONFIG },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    const foreign = { ...(JSON.parse(JSON.stringify(state)) as object), gameType: 'werewolf' };
    expect(() => parseDecryptoState(foreign)).toThrow();
  });
});
