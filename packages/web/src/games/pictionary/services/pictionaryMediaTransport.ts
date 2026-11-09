/** Pictionary drawing media transport (shared factory instance). */

import {
  PICTIONARY_STATE_CODEC,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import {
  createDrawingMediaTransport,
  type DrawingMediaTransport,
} from '@/features/drawing/services/createDrawingMediaTransport';

export const pictionaryMediaTransport: DrawingMediaTransport<PictionaryState> =
  createDrawingMediaTransport({
    gameId: 'pictionary',
    gameName: 'Pictionary',
    stateCodec: PICTIONARY_STATE_CODEC,
  });
