/**
 * Werewolf phase guide message: the non-host phase hints whose single
 * home is the bottom action message. Host ACTION guidance lives on
 * the host console, not here, and Ended has no guide line at all: its
 * bottom is the panel flow's step bar （昨夜信息 → 本局复盘 → 收尾）.
 * Pure over the local state so the guidance matrix test can hold
 * every (status × viewer) cell true without rendering the room hook.
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
    return null;
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
    default:
      return null;
  }
}
