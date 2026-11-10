/**
 * useScopedDraft — scoped local persistence for unconfirmed UI choices.
 *
 * A draft (a night-action seat pick, a panel's step, a notepad) survives
 * a reload only for the exact scope that produced it. The caller names
 * the scope as a flat record (step id, actor seat, round nonce, seat
 * count…); when any field changes, the stored draft is stale and is
 * cleared, never carried over. A stored envelope that fails the caller's
 * `parse` is cleared the same way — the draft is unconfirmed UI state,
 * so a corrupt or older-format value is discarded, not repaired.
 *
 * One storage slot per (namespace, user, room): a newer scope in the
 * same room overwrites the older draft, so a room never accumulates
 * stale slots. A draft equal to `initial` removes the slot. Storage
 * access lives in `services/scopedDraftStore`.
 *
 * `parse` and `initial` are part of the read identity: pass stable
 * references (module constants), not inline literals.
 */

import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  defaultScopedDraftStorage,
  readScopedDraft,
  type ScopedDraftStorage,
  scopedDraftStorageKey,
  writeScopedDraft,
} from '../services/scopedDraftStore';

export type { ScopedDraftStorage } from '../services/scopedDraftStore';

export type ScopedDraftScope = Readonly<Record<string, string | number | null>>;

export interface ScopedDraftOptions<T> {
  /** Draft family, e.g. 'werewolf:night-action'. */
  readonly namespace: string;
  readonly userId: string;
  readonly roomId: string;
  /** Every field that invalidates the draft when it changes. */
  readonly scope: ScopedDraftScope;
  /** The empty draft; a draft equal to it removes the slot. */
  readonly initial: T;
  /** Strict decoder for a stored value; throws on anything this build would not write. */
  readonly parse: (value: unknown) => T;
  /** Storage override for tests. */
  readonly draftStorage?: ScopedDraftStorage;
}

export interface ScopedDraft<T> {
  readonly draft: T;
  /** Replace the draft; the slot is written on the next effect. */
  readonly setDraft: (value: T) => void;
  /** Derive the next draft from the current one. */
  readonly updateDraft: (update: (current: T) => T) => void;
  /** Reset to `initial` (removes the slot). */
  readonly clear: () => void;
}

export function useScopedDraft<T>(options: ScopedDraftOptions<T>): ScopedDraft<T> {
  const { namespace, userId, roomId, scope, initial, parse } = options;
  const draftStorage = options.draftStorage ?? defaultScopedDraftStorage;
  const storageKey = scopedDraftStorageKey({ namespace, userId, roomId });
  const scopeKey = canonicalJson(scope);
  const initialKey = canonicalJson(initial);

  const loaded = useMemo(
    () => readScopedDraft(draftStorage, storageKey, scopeKey, initial, parse),
    [draftStorage, storageKey, scopeKey, initial, parse],
  );
  // The in-memory edit belongs to one scope; a scope change drops it so the
  // storage slot (already cleared as stale) is the only truth for the new
  // scope — and for the old one, should it come back.
  const [edited, setEdited] = useState<{ readonly scopeKey: string; readonly value: T } | null>(
    null,
  );
  if (edited !== null && edited.scopeKey !== scopeKey) setEdited(null);
  const draft = edited !== null && edited.scopeKey === scopeKey ? edited.value : loaded.value;

  useEffect(() => {
    if (loaded.shouldClear) draftStorage.remove(storageKey);
  }, [draftStorage, loaded.shouldClear, storageKey]);

  useEffect(() => {
    if (edited === null || edited.scopeKey !== scopeKey) return;
    if (canonicalJson(edited.value) === initialKey) {
      draftStorage.remove(storageKey);
      return;
    }
    writeScopedDraft(draftStorage, storageKey, scopeKey, edited.value);
  }, [draftStorage, edited, initialKey, scopeKey, storageKey]);

  const updateDraft = useCallback(
    (update: (current: T) => T) => {
      setEdited((current) => {
        const base =
          current !== null && current.scopeKey === scopeKey ? current.value : loaded.value;
        return { scopeKey, value: update(base) };
      });
    },
    [loaded.value, scopeKey],
  );

  const setDraft = useCallback((value: T) => setEdited({ scopeKey, value }), [scopeKey]);

  const clear = useCallback(() => setEdited({ scopeKey, value: initial }), [initial, scopeKey]);

  return { draft, setDraft, updateDraft, clear };
}
