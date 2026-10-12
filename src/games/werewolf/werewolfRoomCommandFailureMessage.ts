/** Werewolf presentation for domain command rejections. */

import type { GameState } from '@game-judge/game-engine/games/werewolf/public';

import { createRoomCommandFailureMessage } from '@/features/room/session/createRoomCommandFailureMessage';

/**
 * Werewolf owns no reason map of its own: every reason goes through the
 * shared reason-code translation, via the same factory the other games
 * use, so a werewolf-specific message lands here when one is needed.
 */
export const getWerewolfRoomCommandFailureMessage = createRoomCommandFailureMessage<GameState>({});
