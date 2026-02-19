/**
 * useNightProgress.ts - Night progress indicator
 *
 * Computes nightProgress derived state (current step / total / role name).
 * Does not import services directly, does not contain action processing / policy logic,
 * does not render UI or hold JSX, and does not own any gate state
 * (gates are in useActionOrchestrator).
 */

import type { SchemaId } from '@werewolf/game-engine/models/roles';
import { buildNightPlan } from '@werewolf/game-engine/models/roles';
import { useMemo } from 'react';

import type { LocalGameState } from '@/types/GameStateTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NightProgressInfo {
  /** 1-based step index for display */
  current: number;
  /** Total number of night steps */
  total: number;
  /** Display name of the current step's role */
  roleName: string | undefined;
}

interface UseNightProgressParams {
  /** Current night step id (null when not in night phase) */
  currentStepId: SchemaId | null;
  /** Game state (for status + template.roles to build night plan) */
  gameState: LocalGameState | null;
}

interface UseNightProgressResult {
  /** Night progress info for NightProgressIndicator, null when not applicable */
  nightProgress: NightProgressInfo | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useNightProgress({
  currentStepId,
  gameState,
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

  return { nightProgress };
}
