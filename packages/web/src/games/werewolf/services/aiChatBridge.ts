/**
 * aiChatBridge - cross-component AI chat message bridge
 *
 * Module-level singleton listener that lets components outside the chat bubble (notepad, role
 * cards, the encyclopedia) ask the AI chat to send a message. The bubble registers itself while
 * it is mounted, so entry points show only while there is a chat to receive the request.
 */

import { getRoleSpec, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { useSyncExternalStore } from 'react';

import { buildRolePlayGuidePrompt } from '@/games/werewolf/components/AIChatBubble/rolePlayGuide';
import { showConfirmAlert } from '@/utils/alertPresets';

interface AIChatBridgePayload {
  /** Full text sent to AI (notes content + prompt) */
  readonly fullText: string;
  /** Short text displayed in the user message bubble */
  readonly displayText: string;
  /** Optional maxTokens override (defaults to the service's maxTokens) */
  readonly maxTokens?: number;
}

type AIChatBridgeListener = (payload: AIChatBridgePayload) => void;

let listener: AIChatBridgeListener | null = null;
const availabilityListeners = new Set<() => void>();

/** Register the chat bubble's listener (on mount); pass null to clear it. */
export function setAIChatBridgeListener(cb: AIChatBridgeListener | null): void {
  const wasAvailable = listener !== null;
  listener = cb;
  if (wasAvailable !== (cb !== null)) {
    for (const notify of availabilityListeners) notify();
  }
}

function subscribeAvailability(onChange: () => void): () => void {
  availabilityListeners.add(onChange);
  return () => {
    availabilityListeners.delete(onChange);
  };
}

function isAIChatAvailable(): boolean {
  return listener !== null;
}

/** Whether an AI chat is mounted to receive requests (a werewolf room is open). */
export function useAIChatAvailable(): boolean {
  return useSyncExternalStore(subscribeAvailability, isAIChatAvailable);
}

/** Request the AI chat to send a message; entry points show only while a chat is mounted. */
export function requestAIChatMessage(payload: AIChatBridgePayload): void {
  if (listener === null) {
    throw new Error('[FAIL-FAST] AI chat request without a mounted AI chat');
  }
  listener(payload);
}

/** After user confirms, request AI to analyze a role's playstyle. */
export function askAIAboutRole(roleId: RoleId, onClose: () => void): void {
  const prompt = buildRolePlayGuidePrompt(roleId);
  const roleName = getRoleSpec(roleId).displayName;
  showConfirmAlert('AI 攻略', `让 AI 分析「${roleName}」的玩法？`, () => {
    onClose();
    requestAIChatMessage({
      fullText: prompt,
      displayText: `${roleName} 攻略`,
      maxTokens: 1024,
    });
  });
}
