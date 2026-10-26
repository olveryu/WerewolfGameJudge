/** Assemble shared shell structure without interpreting game phases or interaction policies. */

import { buildRoomHeaderModel, type BuildRoomHeaderModelInput } from './buildRoomHeaderModel';
import type { RoomSeatDataSource } from './RoomSeatDataSource';
import type { RoomSeatBoardModel, RoomShellModel } from './RoomShellModel';

export interface RoomShellModelInput
  extends Omit<RoomShellModel, 'header' | 'seats'>, BuildRoomHeaderModelInput {
  readonly seatSource: RoomSeatDataSource;
  readonly seatsVisuallyDisabled: boolean;
  readonly onSeatPress: RoomSeatBoardModel['onSeatPress'];
  readonly onBotSeatLongPress: RoomSeatBoardModel['onBotSeatLongPress'];
}

export interface RoomShellModelWithHeaderInput extends Omit<
  RoomShellModelInput,
  keyof BuildRoomHeaderModelInput
> {
  readonly header: RoomShellModel['header'];
}

/** Project explicit shell inputs; game-owned fields are never copied into the public model. */
export function createRoomShellModel(
  input: RoomShellModelInput | RoomShellModelWithHeaderInput,
): RoomShellModel {
  return {
    roomCode: input.roomCode,
    phase: input.phase,
    step: input.step,
    isAudioPlaying: input.isAudioPlaying,
    capabilities: input.capabilities,
    header: 'header' in input ? input.header : buildRoomHeaderModel(input),
    connection: input.connection,
    seats: {
      source: input.seatSource,
      visuallyDisabled: input.seatsVisuallyDisabled,
      onSeatPress: input.onSeatPress,
      onBotSeatLongPress: input.onBotSeatLongPress,
    },
    seatConfirmation: input.seatConfirmation,
    profile: input.profile,
    share: input.share,
    bottomActions: input.bottomActions,
    hostManagement: input.hostManagement,
    controlledSeat: input.controlledSeat,
  };
}
