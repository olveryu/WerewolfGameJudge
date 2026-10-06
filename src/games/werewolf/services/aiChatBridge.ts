/**
 * aiChatBridge - cross-component AI chat message bridge
 *
 * Module-level singleton callback that allows non-AIChatBubble components (e.g., NotepadScreen)
 * to request AI chat to send a message. Pattern matches alert.ts's setAlertListener.
 * No React components or game state.
 */

import { ROLE_SPECS, type RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { buildRolePlayGuidePrompt } from '@/games/werewolf/components/AIChatBubble/rolePlayGuide';

export interface AIChatBridgePayload {
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

export interface AIAboutRoleRequest {
  roleName: string;
  payload: AIChatBridgePayload;
}

/**
 * Build the AI role-analysis request for a role (pure — no UI).
 * Callers show their own <AlertModal> confirm, then on confirm call
 * requestAIChatMessage(request.payload).
 * Returns null if the roleId is invalid or prompt construction fails.
 */
export function buildAIAboutRoleRequest(roleId: RoleId): AIAboutRoleRequest | null {
  const prompt = buildRolePlayGuidePrompt(roleId);
  if (!prompt) return null;
  const spec = ROLE_SPECS[roleId];
  const roleName = spec?.displayName ?? roleId;
  return {
    roleName,
    payload: {
      fullText: prompt,
      displayText: `${roleName} 攻略`,
      maxTokens: 1024,
    },
  };
}
