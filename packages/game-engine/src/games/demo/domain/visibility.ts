/** Demo per-seat view model: identities are cropped by the viewer (UI-level privacy). */

import { getBotDisplayName } from '../../../platform/room/getBotDisplayName';
import { listUnviewedSeats } from '../../../platform/room/identityViewing';
import { buildSeatIdentityView } from '../../../platform/room/seatIdentity';
import {
  type DemoPhaseKind,
  type DemoState,
  getDemoViewingParticipants,
  isDemoOccupiedSeat,
} from '../state/types';

export interface DemoSeatView {
  readonly seat: number;
  readonly displayName: string;
  readonly isBot: boolean;
  /** 终局揭晓前为 null。 */
  readonly identity: string | null;
}

export interface DemoViewModel {
  readonly phase: DemoPhaseKind;
  readonly mySeat: number | null;
  /** 本人身份；未发牌时为 null。他人身份只在终局后由 seats 公开。 */
  readonly myIdentity: string | null;
  readonly seats: readonly DemoSeatView[];
  /** 本人是否已查看自己的身份（揭示动画锚点）。 */
  readonly hasViewedRole: boolean;
  /** 尚未查看身份的座位（公开信息，含机器人）。 */
  readonly unviewedRoleSeats: readonly number[];
  // TODO(gameplay): 玩法投影（公开进度、本人私有信息）加在这里：
  // 私有字段只许按 viewerSeat 裁剪产出，不许把完整状态透传给客户端拼装。
}

/**
 * Builds the cropped view model for one viewer.
 * @param viewerSeat Seat of the viewer; null for spectators without a seat.
 */
export function getDemoViewModel(state: DemoState, viewerSeat: number | null): DemoViewModel {
  const revealed = state.phase.kind === 'ended';
  const seats: DemoSeatView[] = [];
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    if (!isDemoOccupiedSeat(state, seat)) continue;
    seats.push({
      ...buildSeatIdentityView(state.roster, seat, getBotDisplayName),
      identity: revealed ? (state.identities[seat] ?? null) : null,
    });
  }
  return {
    phase: state.phase.kind,
    mySeat: viewerSeat,
    myIdentity: viewerSeat === null ? null : (state.identities[viewerSeat] ?? null),
    seats,
    hasViewedRole: viewerSeat !== null && state.roleViewedSeats.includes(viewerSeat),
    unviewedRoleSeats: listUnviewedSeats(
      getDemoViewingParticipants(state),
      state.roleViewedSeats,
    ).map((participant) => participant.seat),
  };
}
