/**
 * useNightProgress.ts - Night progress indicator
 *
 * Computes nightProgress derived state (current step / total / role name).
 * Does not import services directly, does not contain action processing / policy logic,
 * does not render UI or hold JSX, and does not own any gate state
 * (gates are in useActionOrchestrator).
 */

import type { SchemaId } from '@werewolf/game-engine/models/roles';
import { buildNightPlan, getRoleDisplayAs, getRoleSpec } from '@werewolf/game-engine/models/roles';
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

    // displayAs + seerLabelMap 处理：对玩家隐藏灯影预言家真实身份
    let roleName = currentStep?.displayName;
    if (currentStep) {
      const displayAs = getRoleDisplayAs(currentStep.roleId);
      if (displayAs) {
        const displaySpec = getRoleSpec(displayAs);
        roleName = displaySpec?.displayName ?? roleName;
      }
      // 双预言家标签：seerLabelMap存在时显示 "X号预言家"
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
