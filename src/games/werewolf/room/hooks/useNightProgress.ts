/**
 * useNightProgress.ts - Night progress indicator
 *
 * Computes nightProgress derived state (current step / total / role name).
 * Does not import services directly, does not contain action processing / policy logic,
 * does not render UI or hold JSX, and does not own any gate state
 * (gates are in useActionOrchestrator).
 */

import type { SchemaId } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import {
  buildNightPlan,
  getRoleDisplayAs,
  getRoleSpec,
} from '@game-judge/game-engine/games/werewolf/public';
import { useMemo } from 'react';

import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

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
  gameState: LocalGameState;
}

interface UseNightProgressResult {
  /** Werewolf night progress mapped into the shared room progress model. */
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
    if (!currentStepId || gameState.status !== GameStatus.Ongoing) {
      return null;
    }

    // Build night plan from template roles (same as Host uses)
    const nightPlan = buildNightPlan(gameState.template.roles, gameState.seerLabelMap);

    // Find current step index in the dynamically built plan
    const stepIndex = nightPlan.steps.findIndex((step) => step.stepId === currentStepId);
    if (stepIndex === -1) return null;

    const currentStep = nightPlan.steps[stepIndex];

    // displayAs + seerLabelMap: hide the Shadow Seer's true identity from players
    let roleName = currentStep?.displayName;
    if (currentStep) {
      const displayAs = getRoleDisplayAs(currentStep.roleId);
      if (displayAs) {
        const displaySpec = getRoleSpec(displayAs);
        roleName = displaySpec?.displayName ?? roleName;
      }
      // Dual-seer label: show "X号预言家" when seerLabelMap is present
      const labelMap = gameState.seerLabelMap;
      if (labelMap) {
        const label = labelMap[currentStep.roleId];
        if (label != null && roleName) {
          roleName = `${label}号${roleName}`;
        }
      }
    }

    return {
      current: stepIndex + 1, // 1-based for display
      total: nightPlan.length,
      roleName,
    };
  }, [currentStepId, gameState]);

  return { nightProgress };
}
