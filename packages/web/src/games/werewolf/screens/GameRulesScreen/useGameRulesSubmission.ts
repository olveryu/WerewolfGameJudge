/**
 * useGameRulesSubmission — final Werewolf config step: create a room or save an edited board,
 * through the shared create/edit controller. Roles and rules arrive validated from ConfigScreen.
 */
import {
  createCustomTemplate,
  type GameRuleOverrides,
  type GameState,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import { useNavigate } from 'react-router';

import { useAuthContext } from '@/contexts/AuthContext';
import { useRoomConfigSubmission } from '@/features/room/controllers/useRoomConfigSubmission';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { getWerewolfRoomCommandFailureMessage } from '@/games/werewolf/room/werewolfRoomCommandFailureMessage';

interface UseGameRulesSubmissionParams {
  readonly session: WerewolfRoomSession;
  readonly roles: readonly RoleId[];
  readonly rules: GameRuleOverrides;
  readonly existingRoomCode: string | undefined;
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
}: UseGameRulesSubmissionParams) {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const submission = useRoomConfigSubmission<GameState>({
    params:
      existingRoomCode === undefined
        ? { mode: 'create' }
        : { mode: 'edit', roomCode: existingRoomCode },
    navigate,
    getFailureMessage: getWerewolfRoomCommandFailureMessage,
    creationLabel: '创建房间',
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
    submit: submission.submit,
    isSubmitting: submission.isSubmitting,
    isEditMode: existingRoomCode !== undefined,
  };
}
