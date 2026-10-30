/**
 * Werewolf phase guide message: the non-host phase hints whose single
 * home is the bottom action message. Host ACTION guidance lives on
 * the host console, not here, and Ended has no guide line at all: its
 * bottom is the panel flow's step bar （昨夜信息 → 本局复盘 → 收尾）.
 * Pure over the projected view model so the guidance matrix test can
 * hold every (status × viewer) cell true without rendering the room hook.
 */
import { GameStatus, type WerewolfViewModel } from '@game-judge/game-engine/games/werewolf/public';

import { VIEW_IDENTITY_LABEL } from '@/features/room/model/RoomBottomActions';

export function buildWerewolfGuideMessage(input: {
  readonly isHost: boolean;
  readonly roomStatus: GameStatus;
  readonly mySeat: number | null;
  readonly viewModel: Pick<WerewolfViewModel, 'seats' | 'template'>;
}): string | null {
  const { isHost, roomStatus, mySeat, viewModel } = input;

  if (isHost) {
    return null;
  }

  switch (roomStatus) {
    case GameStatus.Unseated:
    case GameStatus.Seated:
      return '等待所有玩家入座';
    case GameStatus.Assigned: {
      // A spectator has no identity to view: they wait on the players,
      // like every other game's viewing-phase spectator sentence.
      if (mySeat === null) return '等待玩家查看身份';
      const viewedCount = viewModel.seats.filter((seat) => seat.hasViewedRole).length;
      if (viewedCount < viewModel.template.numberOfPlayers) {
        return `请点击下方「${VIEW_IDENTITY_LABEL}」查看你的身份`;
      }
      return null;
    }
    case GameStatus.Ready:
      return '准备就绪，等待房主开始';
    default:
      return null;
  }
}
