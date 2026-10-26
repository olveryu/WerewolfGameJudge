/**
 * useGameRulesSubmission — final Werewolf config step: create a room or save an edited template.
 *
 * Owns only submission; roles and rules arrive fully validated from ConfigScreen.
 */
import {
  createCustomTemplate,
  type GameRuleOverrides,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import { useCallback, useState } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useRoomCreationController } from '@/features/room/controllers/useRoomCreationController';
import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { translateReasonCode } from '@/utils/errorUtils';
import { configLog } from '@/utils/logger';

interface UseGameRulesSubmissionParams {
  readonly client: WerewolfGameClient;
  readonly roles: readonly RoleId[];
  readonly existingRoomCode: string | undefined;
  readonly onExitFlow: () => void;
  readonly onRoomCreated: (roomCode: string) => void;
}

export function useGameRulesSubmission({
  client,
  roles,
  existingRoomCode,
  onExitFlow,
  onRoomCreated,
}: UseGameRulesSubmissionParams) {
  const { user } = useAuthContext();
  const { createRoom, isCreating } = useRoomCreationController();
  const [isWorkflowSubmitting, setIsWorkflowSubmitting] = useState(false);
  const isEditMode = existingRoomCode !== undefined;

  const submit = useCallback(
    async (rules: GameRuleOverrides) => {
      const template = createCustomTemplate([...roles]);
      if (Object.values(rules).some((value) => value !== undefined)) {
        template.rules = rules;
      }

      setIsWorkflowSubmitting(true);
      try {
        if (isEditMode) {
          const result = await client.updateTemplate(template);
          if (!isSuccessfulRoomCommand(result)) {
            showErrorAlert('更新失败', translateReasonCode(getRoomCommandFailureReason(result)));
            return;
          }
          onExitFlow();
          return;
        }

        if (user === null) {
          throw new Error('[FAIL-FAST] Werewolf room creation requires an authenticated user');
        }
        // Create the room record first so navigation only ever sees the confirmed roomCode.
        const record = await createRoom({
          expectedHostUserId: user.id,
          gameType: 'werewolf',
          config: {
            templateRoles: template.roles,
            ...(template.rules === undefined ? {} : { rules: template.rules }),
          },
        });
        onRoomCreated(record.roomCode);
      } catch (error) {
        handleError(error, {
          label: isEditMode ? '更新房间' : '创建房间',
          logger: configLog,
          alertMessage: isEditMode ? '更新房间失败，请重试' : '创建房间失败，请重试',
        });
      } finally {
        setIsWorkflowSubmitting(false);
      }
    },
    [roles, isEditMode, client, user, createRoom, onExitFlow, onRoomCreated],
  );

  return { submit, isSubmitting: isWorkflowSubmitting || isCreating, isEditMode };
}
