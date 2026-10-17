/**
 * Werewolf phase guide message: the non-host phase hints whose single
 * home is the bottom action message, plus the Ended settlement line
 * (information for every viewer, the host included). Host ACTION
 * guidance lives on the host console, not here. Pure over the local
 * state so the guidance matrix test can hold every (status × viewer)
 * cell true without rendering the room hook.
 */
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

import { STATIC_BUTTONS } from './hooks/bottomLayoutConfig';

export function buildWerewolfGuideMessage(input: {
  readonly isHost: boolean;
  readonly roomStatus: GameStatus;
  readonly mySeat: number | null;
  readonly gameState: LocalGameState;
}): string | null {
  const { isHost, roomStatus, mySeat, gameState } = input;

  if (isHost) {
    return roomStatus === GameStatus.Ended
      ? '天亮了 →「昨夜信息」查看结果，「本局复盘」查看/分享战报'
      : null;
  }

  const players = gameState.players;
  const totalSeats = gameState.template.numberOfPlayers;

  switch (roomStatus) {
    case GameStatus.Unseated:
    case GameStatus.Seated:
      return '等待所有玩家入座';
    case GameStatus.Assigned: {
      // A spectator has no identity to view: they wait on the players,
      // like every other game's viewing-phase spectator sentence.
      if (mySeat === null) return '等待玩家查看身份';
      let viewedCount = 0;
      for (const p of players.values()) {
        if (p && p.hasViewedRole) viewedCount++;
      }
      if (viewedCount < totalSeats) {
        return `请点击下方「${STATIC_BUTTONS.viewRole.label}」查看你的身份`;
      }
      return null;
    }
    case GameStatus.Ready:
      return '准备就绪，等待房主开始';
    case GameStatus.Day:
      return null;
    case GameStatus.Ended: {
      let hostSeat: number | null = null;
      for (const [seat, p] of players) {
        if (p?.userId === gameState.hostUserId) {
          hostSeat = seat;
          break;
        }
      }
      const hostLabel = hostSeat !== null ? `${hostSeat + 1}号玩家` : '房主';
      return `天亮了 → 昨夜信息/本局复盘由${hostLabel}操作`;
    }
    default:
      return null;
  }
}
