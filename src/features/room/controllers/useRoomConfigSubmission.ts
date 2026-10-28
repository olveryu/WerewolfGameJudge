/** Coordinate config submission and navigation; games own validation and command construction. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RoomCreationRequest } from '@/features/room/model/RoomDirectory';
import {
  replaceWithCreatedRoom,
  returnToActiveRoom,
} from '@/features/room/navigation/roomFlowNavigation';
import type { DispatchOutcome } from '@/platform/realtime/types';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import { useRoomCommandSubmission } from './useRoomCommandSubmission';
import { useRoomCreationController } from './useRoomCreationController';

interface RoomConfigSubmissionInput<TState extends BaseGameState<string>> {
  readonly params:
    | { readonly mode: 'create' }
    | { readonly mode: 'edit'; readonly roomCode: string };
  readonly navigation: Parameters<typeof returnToActiveRoom>[0];
  readonly getFailureMessage: (result: DispatchOutcome<TState>) => string;
  readonly createRequest: () => RoomCreationRequest;
  readonly updateConfig: () => Promise<DispatchOutcome<TState>>;
  readonly creationLabel: string;
}

/** Reuse creation and command controllers without changing game-owned submission contracts. */
export function useRoomConfigSubmission<TState extends BaseGameState<string>>(
  input: RoomConfigSubmissionInput<TState>,
) {
  const creation = useRoomCreationController();
  const submission = useRoomCommandSubmission(input.getFailureMessage);
  const submit = () => {
    const { params, navigation } = input;
    if (params.mode === 'edit') {
      void submission.submit('保存设置', input.updateConfig).then((success) => {
        if (success) returnToActiveRoom(navigation, params.roomCode);
      });
      return;
    }
    void creation
      .createRoom(input.createRequest())
      .then((record) => replaceWithCreatedRoom(navigation, record.roomCode))
      .catch((error: unknown) =>
        handleError(error, {
          label: input.creationLabel,
          logger: configLog,
          alertMessage: '创建失败，请重试',
        }),
      );
  };
  return { submit, isSubmitting: creation.isCreating || submission.isSubmitting };
}
