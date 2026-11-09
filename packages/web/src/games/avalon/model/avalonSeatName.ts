import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';

/** "3 号 · 名字"：阿瓦隆弹窗里的座位称呼；座位无人时用"座位N"占位。 */
export function formatAvalonSeatName(viewModel: AvalonViewModel, seat: number): string {
  const entry = viewModel.seats.find((seatView) => seatView.seat === seat);
  return `${seat + 1} 号 · ${entry?.displayName ?? `座位${seat + 1}`}`;
}
