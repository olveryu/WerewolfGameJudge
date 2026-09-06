/** Pictionary persisted-state duration decoding contracts. */

import type { CreateGameContext } from '../../../platform/engine';
import { pictionaryEngine } from '../engine';
import { parsePictionaryState } from '../state/parseState';
import { DEFAULT_PICTIONARY_CONFIG } from '../state/types';

const CREATE_CONTEXT: CreateGameContext = {
  roomCode: '2468',
  hostUserId: 'user-0',
  nowMs: 1_000,
  commandId: 'create-room',
};

describe('Pictionary state parsing', () => {
  it('preserves every supported unlimited duration', () => {
    const state = pictionaryEngine.createInitialState(
      {
        ...DEFAULT_PICTIONARY_CONFIG,
        drawingDurationSeconds: null,
        guessDurationSeconds: null,
        galleryItemDurationSeconds: null,
      },
      CREATE_CONTEXT,
    );

    expect(parsePictionaryState(state).config).toMatchObject({
      drawingDurationSeconds: null,
      guessDurationSeconds: null,
      galleryItemDurationSeconds: null,
    });
  });

  it('rejects an unsupported duration', () => {
    const state = pictionaryEngine.createInitialState(DEFAULT_PICTIONARY_CONFIG, CREATE_CONTEXT);
    const invalidState = {
      ...state,
      config: { ...state.config, galleryItemDurationSeconds: 7 },
    };

    expect(() => parsePictionaryState(invalidState)).toThrow(
      'PictionaryState.config.galleryItemDurationSeconds must be a supported Pictionary duration',
    );
  });
});
