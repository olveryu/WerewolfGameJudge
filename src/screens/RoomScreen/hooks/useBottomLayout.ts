/**
 * useBottomLayout — Hook that composes resolveBottomLayout + buildBottomAction.
 *
 * Takes game state values from useRoomScreenState and returns a BottomLayout
 * ready for BottomActionPanel to render.
 */

import { useMemo } from 'react';

import type { BottomActionVM } from './bottomActionBuilder';
import type { BottomLayout, LayoutContext } from './bottomLayoutConfig';
import { resolveBottomLayout } from './resolveBottomLayout';

interface UseBottomLayoutParams {
  /** Layout context fields from game state. */
  ctx: LayoutContext;
  /** Schema-driven action VM from getBottomAction(). */
  schemaVM: BottomActionVM;
}

/**
 * Resolves the three-tier BottomLayout from current game state + schema buttons.
 */
export function useBottomLayout({ ctx, schemaVM }: UseBottomLayoutParams): BottomLayout {
  return useMemo(() => resolveBottomLayout(ctx, schemaVM.buttons), [ctx, schemaVM]);
}
