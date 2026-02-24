/**
 * buildInitialGameState — 构造房间初始 GameState
 *
 * 职责：从 roomCode + hostUid + template 构造「unseated」阶段的初始游戏状态。
 * Host 创建房间时使用此函数，保证 DB 与内存 store 的初始状态来自同一来源（DRY）。
 * 纯函数，无副作用，不依赖 React Native / Expo / IO。
 */

import { GameStatus } from '../../models/GameStatus';
import type { GameTemplate } from '../../models/Template';
import type { GameState } from '../../protocol/types';

export function buildInitialGameState(
  roomCode: string,
  hostUid: string,
  template: GameTemplate,
): GameState {
  const players: GameState['players'] = {};
  for (let i = 0; i < template.numberOfPlayers; i++) {
    players[i] = null;
  }

  return {
    roomCode,
    hostUid,
    status: GameStatus.Unseated,
    templateRoles: template.roles,
    players,
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
  };
}
