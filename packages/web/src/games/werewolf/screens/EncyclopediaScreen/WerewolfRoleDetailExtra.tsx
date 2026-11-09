/**
 * WerewolfRoleDetailExtra — the werewolf encyclopedia detail hero's AI 攻略 pill, injected through
 * the shared detail sheet's `headerExtra` slot. Shown only while an AI chat is mounted.
 */
import './WerewolfRoleDetailExtra.css';

import { isValidRoleId } from '@game-judge/game-engine/games/werewolf/public';

import type { EncyclopediaRoleEntry } from '@/features/encyclopedia/encyclopediaSource';
import { askAIAboutRole, useAIChatAvailable } from '@/games/werewolf/services/aiChatBridge';
import IconSparklesOutline from '~icons/ion/sparkles-outline';

export function WerewolfRoleDetailExtra({
  entry,
  onClose,
}: {
  readonly entry: EncyclopediaRoleEntry;
  readonly onClose: () => void;
}) {
  const isAIChatAvailable = useAIChatAvailable();
  const roleId = entry.id;
  if (!isValidRoleId(roleId)) {
    throw new Error(`[FAIL-FAST] Werewolf encyclopedia entry is not a role: ${roleId}`);
  }
  if (!isAIChatAvailable) return null;

  return (
    <button
      type="button"
      className="encyclopedia-ai-pill"
      onClick={() => askAIAboutRole(roleId, onClose)}
    >
      <IconSparklesOutline aria-hidden />
      AI 攻略
    </button>
  );
}
