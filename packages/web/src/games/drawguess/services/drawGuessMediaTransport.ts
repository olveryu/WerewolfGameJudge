/** DrawGuess drawing media transport (shared factory instance). */

import {
  DRAWGUESS_STATE_CODEC,
  type DrawGuessState,
} from '@game-judge/game-engine/games/drawguess/public';

import {
  createDrawingMediaTransport,
  type DrawingMediaTransport,
} from '@/features/drawing/services/createDrawingMediaTransport';

export const drawGuessMediaTransport: DrawingMediaTransport<DrawGuessState> =
  createDrawingMediaTransport({
    gameId: 'drawguess',
    gameName: 'DrawGuess',
    stateCodec: DRAWGUESS_STATE_CODEC,
  });
