/**
 * Local persistence for bottom-panel flow progress (see panelFlow.ts).
 *
 * One JSON record in MMKV, partitioned by (roomId, userId, game round)
 * — the round is the deal's roleRevealRandomNonce, so a redeal or a
 * new game in the same room starts with fresh progress and the old
 * game's record simply becomes unreachable. This is a UI convenience
 * cache only: it never enters room state, never crosses the wire, and
 * a corrupt or missing record degrades to "no progress yet".
 */
import { PANEL_FLOW_PROGRESS_KEY } from '@/config/storageKeys';
import { storage } from '@/services/infra/localStorage';

import type { PanelFlowProgress } from './panelFlow';
import { EMPTY_PANEL_FLOW_PROGRESS } from './panelFlow';

/** Identifies one game's progress partition. */
export interface PanelFlowScope {
  readonly roomId: string;
  readonly userId: string | null;
  readonly roleRevealRandomNonce: string | null;
}

type PanelFlowProgressRecord = Readonly<Record<string, PanelFlowProgress>>;

function panelFlowScopeKey(scope: PanelFlowScope): string {
  return `${scope.roomId}:${scope.userId ?? 'anonymous'}:${scope.roleRevealRandomNonce ?? 'none'}`;
}

function isPanelFlowProgress(value: unknown): value is PanelFlowProgress {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { lastNightInfoConfirmed?: unknown; nightReviewOpened?: unknown };
  return (
    typeof candidate.lastNightInfoConfirmed === 'boolean' &&
    typeof candidate.nightReviewOpened === 'boolean'
  );
}

function readRecord(): PanelFlowProgressRecord {
  const raw = storage.getString(PANEL_FLOW_PROGRESS_KEY);
  if (raw === undefined) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const record: Record<string, PanelFlowProgress> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isPanelFlowProgress(value)) record[key] = value;
    }
    return record;
  } catch {
    return {};
  }
}

export function readPanelFlowProgress(scope: PanelFlowScope): PanelFlowProgress {
  return readRecord()[panelFlowScopeKey(scope)] ?? EMPTY_PANEL_FLOW_PROGRESS;
}

/** Merge a progress patch into the scope's record, persist, and return the new progress. */
export function recordPanelFlowProgress(
  scope: PanelFlowScope,
  patch: Partial<PanelFlowProgress>,
): PanelFlowProgress {
  const scopeKey = panelFlowScopeKey(scope);
  const record = readRecord();
  const next: PanelFlowProgress = { ...(record[scopeKey] ?? EMPTY_PANEL_FLOW_PROGRESS), ...patch };
  storage.set(PANEL_FLOW_PROGRESS_KEY, JSON.stringify({ ...record, [scopeKey]: next }));
  return next;
}
