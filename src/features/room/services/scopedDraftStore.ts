/**
 * Scoped draft slots — the storage side of `useScopedDraft`.
 *
 * One slot per (namespace, user, room) holds an envelope
 * `{ version, scopeKey, value }`. A read returns the value only for the
 * exact scope that wrote it and only when the caller's strict `parse`
 * accepts it; a stale or undecodable slot is reported for removal, never
 * repaired — a draft is unconfirmed UI state.
 */

import { storage } from '@/services/infra/localStorage';

const STORAGE_KEY_PREFIX = '@room:draft:';
const ENVELOPE_VERSION = 1;

export interface ScopedDraftStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface ScopedDraftSlot {
  readonly namespace: string;
  readonly userId: string;
  readonly roomId: string;
}

export interface LoadedScopedDraft<T> {
  readonly value: T;
  /** The slot holds a stale or undecodable envelope and must be removed. */
  readonly shouldClear: boolean;
}

export const defaultScopedDraftStorage: ScopedDraftStorage = storage;

export function scopedDraftStorageKey({ namespace, userId, roomId }: ScopedDraftSlot): string {
  if (namespace.length === 0 || userId.length === 0 || roomId.length === 0) {
    throw new Error('[FAIL-FAST] Scoped draft namespace, user and room must be non-empty');
  }
  return `${STORAGE_KEY_PREFIX}${namespace}:${encodeURIComponent(userId)}:${encodeURIComponent(roomId)}`;
}

export function readScopedDraft<T>(
  draftStorage: ScopedDraftStorage,
  storageKey: string,
  scopeKey: string,
  initial: T,
  parse: (value: unknown) => T,
): LoadedScopedDraft<T> {
  const raw = draftStorage.getString(storageKey);
  if (raw === undefined) return { value: initial, shouldClear: false };
  try {
    const envelope: unknown = JSON.parse(raw);
    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      !('version' in envelope) ||
      envelope.version !== ENVELOPE_VERSION ||
      !('scopeKey' in envelope) ||
      !('value' in envelope)
    ) {
      return { value: initial, shouldClear: true };
    }
    if (envelope.scopeKey !== scopeKey) return { value: initial, shouldClear: true };
    return { value: parse(envelope.value), shouldClear: false };
  } catch {
    // Unconfirmed UI state from another build or a corrupt slot: discard.
    return { value: initial, shouldClear: true };
  }
}

export function writeScopedDraft<T>(
  draftStorage: ScopedDraftStorage,
  storageKey: string,
  scopeKey: string,
  value: T,
): void {
  draftStorage.set(storageKey, JSON.stringify({ version: ENVELOPE_VERSION, scopeKey, value }));
}
