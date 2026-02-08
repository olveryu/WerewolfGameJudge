/**
 * useNightProgress.ts - Night progress indicator + speak order auto-dialog
 *
 * ✅ Allowed:
 *   - Compute nightProgress derived state (current step / total / role name)
 *   - Auto-show speak order dialog when night ends (Host-only, one-shot)
 *   - Reset speak order flag when game restarts
 *
 * ❌ Do NOT:
 *   - Import services directly
 *   - Contain action processing / policy logic
 *   - Render UI or hold JSX
 *   - Own any gate state (gates are in useActionOrchestrator)
 */

import { useMemo, useEffect, useRef } from 'react';
import { buildNightPlan } from '@/models/roles';
import type { SchemaId } from '@/models/roles';
import { GameStatus } from '@/models/Room';
import type { LocalGameState } from '@/services/types/GameStateTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NightProgressInfo {
  /** 1-based step index for display */
  current: number;
  /** Total number of night steps */
  total: number;
  /** Display name of the current step's role */
  roleName: string | undefined;
}

export interface UseNightProgressParams {
  /** Current night step id (null when not in night phase) */
  currentStepId: SchemaId | null;
  /** Game state (for status + template.roles to build night plan) */
  gameState: LocalGameState | null;
  /** Current room status */
  roomStatus: GameStatus;
  /** Whether this device is the Host */
  isHost: boolean;
  /** Whether audio is currently playing (gate for speak order dialog) */
  isAudioPlaying: boolean;
  /** Whether a reveal dialog is pending (gate for speak order dialog) */
  pendingRevealDialog: boolean;
  /** Callback to show the speak order dialog (from useRoomHostDialogs) */
  showSpeakOrderDialog: () => void;
}

export interface UseNightProgressResult {
  /** Night progress info for NightProgressIndicator, null when not applicable */
  nightProgress: NightProgressInfo | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useNightProgress({
  currentStepId,
  gameState,
  roomStatus,
  isHost,
  isAudioPlaying,
  pendingRevealDialog,
  showSpeakOrderDialog,
}: UseNightProgressParams): UseNightProgressResult {
  // ─── Night progress derived state ────────────────────────────────────────

  const nightProgress = useMemo<NightProgressInfo | null>(() => {
    if (!currentStepId || gameState?.status !== 'ongoing') {
      return null;
    }

    // Build night plan from template roles (same as Host uses)
    const nightPlan = buildNightPlan(gameState.template.roles);

    // Find current step index in the dynamically built plan
    const stepIndex = nightPlan.steps.findIndex((step) => step.stepId === currentStepId);
    if (stepIndex === -1) return null;

    const currentStep = nightPlan.steps[stepIndex];
    return {
      current: stepIndex + 1, // 1-based for display
      total: nightPlan.length,
      roleName: currentStep?.displayName,
    };
  }, [currentStepId, gameState]);

  // ─── Speak order dialog auto-show (Host-only, one-shot) ──────────────────

  const hasShownSpeakOrderRef = useRef(false);

  useEffect(() => {
    // Only show once per game, only for host, only when game ended and audio finished
    // P0-FIX: 等待查验结果弹窗关闭后再显示发言顺序弹窗
    if (
      !isHost ||
      roomStatus !== GameStatus.ended ||
      isAudioPlaying ||
      pendingRevealDialog ||
      hasShownSpeakOrderRef.current
    )
      return;

    hasShownSpeakOrderRef.current = true;
    showSpeakOrderDialog();
  }, [isHost, roomStatus, isAudioPlaying, pendingRevealDialog, showSpeakOrderDialog]);

  // Reset speak order flag when game restarts
  useEffect(() => {
    if (roomStatus === GameStatus.unseated || roomStatus === GameStatus.seated) {
      hasShownSpeakOrderRef.current = false;
    }
  }, [roomStatus]);

  return { nightProgress };
}
