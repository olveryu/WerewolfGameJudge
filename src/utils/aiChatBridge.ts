/**
 * aiChatBridge - cross-component AI chat message bridge
 *
 * Module-level singleton callback that allows non-AIChatBubble components (e.g., NotepadScreen)
 * to request AI chat to send a message. Pattern matches alert.ts's setAlertListener.
 * No React components or game state.
 */

import { ROLE_SPECS, type RoleId } from '@werewolf/game-engine/models/roles';

import { buildRolePlayGuidePrompt } from '@/components/AIChatBubble/rolePlayGuide';
import { showConfirmAlert } from '@/utils/alertPresets';

interface AIChatBridgePayload {
  /** Full text sent to AI (notes content + prompt) */
  fullText: string;
  /** Short text displayed in the user message bubble */
  displayText: string;
  /** Optional maxTokens override (defaults to API_CONFIG.maxTokens) */
  maxTokens?: number;
}

type AIChatBridgeListener = (payload: AIChatBridgePayload) => void;

let listener: AIChatBridgeListener | null = null;

/**
 * Register listener (called on AIChatBubble mount).
 * Pass null to clear.
 */
export function setAIChatBridgeListener(cb: AIChatBridgeListener | null): void {
  listener = cb;
}

/**
 * Request AI chat to send a message.
 * Silently ignored if no listener is registered.
 */
export function requestAIChatMessage(payload: AIChatBridgePayload): void {
  listener?.(payload);
}

/**
 * After user confirms, request AI to analyze a role's playstyle.
 *
 * Business logic extracted from RoleCardSimple, passed in by the Screen layer via the `onAskAI` prop.
 * Silently returns if roleId is invalid or prompt construction fails.
 */
export function askAIAboutRole(roleId: RoleId, onClose: () => void): void {
  const prompt = buildRolePlayGuidePrompt(roleId);
  if (!prompt) return;
  const spec = ROLE_SPECS[roleId];
  const roleName = spec?.displayName ?? roleId;
  showConfirmAlert('AI 攻略', `让 AI 分析「${roleName}」的玩法？`, () => {
    onClose();
    requestAIChatMessage({
      fullText: prompt,
      displayText: `${roleName} 攻略`,
      maxTokens: 1024,
    });
  });
}
