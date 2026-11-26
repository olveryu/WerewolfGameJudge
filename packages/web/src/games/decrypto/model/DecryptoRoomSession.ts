/**
 * 解码战对共享房间 session 的特化；传输与命令恢复仍归平台所有。
 */

import type { DecryptoCommand, DecryptoState } from '@game-judge/game-engine/games/decrypto/public';

import type { RoomLink } from '@/platform/realtime/types';

export type DecryptoRoomSession = RoomLink<DecryptoState, DecryptoCommand>;
