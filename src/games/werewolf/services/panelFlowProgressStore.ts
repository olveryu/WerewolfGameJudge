/**
 * Local persistence for bottom-panel flow progress (see
 * games/werewolf/room/panelFlow.ts).
 *
 * One JSON record in MMKV, partitioned by (roomId, userId, game round)
 * — the round is the deal's roleRevealRandomNonce, so a redeal or a
 * new game in the same room starts with fresh progress and the old
 * game's record simply becomes unreachable. This is a UI convenience
 * cache only: it never enters room state, never crosses the wire, and
 * a corrupt or missing record degrades to "no progress yet".
 */
import { z } from 'zod';

import { PANEL_FLOW_PROGRESS_KEY } from '@/config/storageKeys';
import { storage } from '@/services/infra/localStorage';

import type { PanelFlowProgress } from '../room/panelFlow';
import { EMPTY_PANEL_FLOW_PROGRESS } from '../room/panelFlow';

/** Identifies one game's progress partition. */
export interface PanelFlowScope {
  readonly roomId: string;
  readonly userId: string | null;
  readonly roleRevealRandomNonce: string | null;
}

const panelFlowProgressSchema = z.strictObject({
  lastNightInfoConfirmed: z.boolean(),
  nightReviewOpened: z.boolean(),
});

const panelFlowProgressRecordSchema = z.record(z.string(), z.unknown());

type PanelFlowProgressRecord = Readonly<Record<string, PanelFlowProgress>>;

function panelFlowScopeKey(scope: PanelFlowScope): string {
  return `${scope.roomId}:${scope.userId ?? 'anonymous'}:${scope.roleRevealRandomNonce ?? 'none'}`;
}

function readRecord(): PanelFlowProgressRecord {
  const raw = storage.getString(PANEL_FLOW_PROGRESS_KEY);
  if (raw === undefined) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  const recordResult = panelFlowProgressRecordSchema.safeParse(parsed);
  if (!recordResult.success) return {};
  const record: Record<string, PanelFlowProgress> = {};
  for (const [key, value] of Object.entries(recordResult.data)) {
    const entry = panelFlowProgressSchema.safeParse(value);
    if (entry.success) record[key] = entry.data;
  }
  return record;
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
