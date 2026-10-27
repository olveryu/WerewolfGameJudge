/**
 * Assemble shared shell structure without interpreting game phases or interaction policies.
 *
 * The factory is also the one enforcement point of room action ownership
 * (docs/room-shell-contract.md "Action Ownership"): host management is
 * built only for the host, and every bottom button's declared audience
 * is checked against the viewer. Violations are model construction
 * errors and fail fast.
 */

import { buildRoomHeaderModel, type BuildRoomHeaderModelInput } from './buildRoomHeaderModel';
import { resolveHostTaskView } from './resolveHostTaskView';
import type { RoomBottomActionModel, RoomBottomButtonAudience } from './RoomBottomActions';
import type { RoomHostManagementModel } from './RoomHostManagement';
import type { RoomSeatDataSource } from './RoomSeatDataSource';
import type { RoomSeatBoardModel, RoomShellModel } from './RoomShellModel';
import { resolveEffectiveSeat, type RoomViewer } from './RoomViewer';

export interface RoomShellModelInput
  extends Omit<RoomShellModel, 'header' | 'seats' | 'hostManagement'>, BuildRoomHeaderModelInput {
  readonly seatSource: RoomSeatDataSource;
  readonly seatsVisuallyDisabled: boolean;
  readonly onSeatPress: RoomSeatBoardModel['onSeatPress'];
  readonly onBotSeatLongPress: RoomSeatBoardModel['onBotSeatLongPress'];
  /**
   * Builds the host's management surface. Invoked only when
   * `viewer.isHost`; games never gate it on host identity themselves.
   * A host phase with nothing to manage returns null.
   */
  readonly buildHostManagement: () => RoomHostManagementModel | null;
}

export interface RoomShellModelWithHeaderInput extends Omit<
  RoomShellModelInput,
  keyof BuildRoomHeaderModelInput
> {
  readonly header: RoomShellModel['header'];
}

interface AudienceTagged {
  readonly key: string;
  readonly audience: RoomBottomButtonAudience;
}

function collectBottomButtons(model: RoomBottomActionModel): readonly AudienceTagged[] {
  if (model.kind === 'dock') {
    return [model.leading, model.primary, model.trailing].filter(
      (button): button is NonNullable<typeof button> => button !== null,
    );
  }
  return [...model.layout.primary, ...model.layout.secondary, ...model.layout.ghost];
}

/**
 * Every bottom button must be addressed to this viewer: `participant`
 * buttons need an effective seat. A button that fails is a game adapter
 * emitting an action its viewer may not hold — the exact bug the
 * ownership contract exists to surface.
 */
function assertBottomActionAudiences(
  viewer: RoomViewer,
  controlledSeat: number | null,
  bottomActions: RoomBottomActionModel,
): void {
  const effectiveSeat = resolveEffectiveSeat(viewer, controlledSeat);
  for (const button of collectBottomButtons(bottomActions)) {
    if (button.audience === 'participant' && effectiveSeat === null) {
      throw new Error(
        `Bottom action "${button.key}" is a participant action but the viewer holds no seat`,
      );
    }
  }
}

/** Project explicit shell inputs; game-owned fields are never copied into the public model. */
export function createRoomShellModel(
  input: RoomShellModelInput | RoomShellModelWithHeaderInput,
): RoomShellModel {
  assertBottomActionAudiences(
    input.viewer,
    input.controlledSeat === null ? null : input.controlledSeat.seat,
    input.bottomActions,
  );
  const hostManagement = input.viewer.isHost ? input.buildHostManagement() : null;
  // Validate task references at assembly so a dangling key fails here, not in render.
  if (hostManagement !== null) resolveHostTaskView(hostManagement);
  return {
    roomCode: input.roomCode,
    viewer: input.viewer,
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
    hostManagement,
    controlledSeat: input.controlledSeat,
  };
}
