/**
 * useGameRulesSubmission — final Werewolf config step: create a room or save an edited board,
 * through the shared create/edit controller. Roles and rules arrive validated from ConfigScreen.
 */
import {
  createCustomTemplate,
  type GameRuleOverrides,
  type GameState,
  GameStatus,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import { useNavigate } from 'react-router';

import { useAuthContext } from '@/contexts/AuthContext';
import { useRoomConfigSubmission } from '@/features/room/controllers/useRoomConfigSubmission';
import { useRoomLinkSnapshot } from '@/features/room/controllers/useRoomLinkSnapshot';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { getWerewolfRoomCommandFailureMessage } from '@/games/werewolf/room/werewolfRoomCommandFailureMessage';
import { showErrorAlert } from '@/utils/alertPresets';

interface UseGameRulesSubmissionParams {
  readonly session: WerewolfRoomSession;
  readonly roles: readonly RoleId[];
  readonly rules: GameRuleOverrides;
  readonly existingRoomCode: string | undefined;
  readonly onEditSaved?: () => void;
}

/** Only rules the user has set travel as overrides; absent keys keep the engine defaults. */
function toTemplateConfig(roles: readonly RoleId[], rules: GameRuleOverrides) {
  const template = createCustomTemplate([...roles]);
  const hasRules = Object.values(rules).some((value) => value !== undefined);
  return { templateRoles: template.roles, rules: hasRules ? rules : undefined };
}

export function useGameRulesSubmission({
  session,
  roles,
  rules,
  existingRoomCode,
  onEditSaved,
}: UseGameRulesSubmissionParams) {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const snapshot = useRoomLinkSnapshot(session);
  const canEdit = (current: typeof snapshot) =>
    existingRoomCode === undefined ||
    (current.phase === 'ready' &&
      current.identity.room.roomCode === existingRoomCode &&
      user !== null &&
      current.room.state.hostUserId === user.id &&
      (current.room.state.status === GameStatus.Unseated ||
        current.room.state.status === GameStatus.Seated));
  const submission = useRoomConfigSubmission<GameState>({
    params:
      existingRoomCode === undefined
        ? { mode: 'create' }
        : { mode: 'edit', roomCode: existingRoomCode },
    navigate,
    getFailureMessage: getWerewolfRoomCommandFailureMessage,
    creationLabel: '创建房间',
    ...(onEditSaved === undefined ? {} : { onEditSaved }),
    createRequest: () => {
      if (user === null) {
        throw new Error('[FAIL-FAST] Werewolf room creation requires an authenticated user');
      }
      const config = toTemplateConfig(roles, rules);
      return {
        expectedHostUserId: user.id,
        gameType: 'werewolf',
        config: {
          templateRoles: config.templateRoles,
          ...(config.rules === undefined ? {} : { rules: config.rules }),
        },
      };
    },
    updateConfig: () => {
      const config = toTemplateConfig(roles, rules);
      return session.dispatch(
        {
          type: 'werewolf.config.update',
          templateRoles: [...config.templateRoles],
          rules: config.rules === undefined ? undefined : { ...config.rules },
        },
        { controlledSeat: null, label: '保存设置', durable: false },
      );
    },
  });
  return {
    submit: () => {
      if (!canEdit(session.getSnapshot())) {
        showErrorAlert('无法保存设置', '房间状态或权限已变化，请返回房间查看。');
        return;
      }
      submission.submit();
    },
    isSubmitting: submission.isSubmitting,
    isEditMode: existingRoomCode !== undefined,
    isEditAvailable: canEdit(snapshot),
  };
}
