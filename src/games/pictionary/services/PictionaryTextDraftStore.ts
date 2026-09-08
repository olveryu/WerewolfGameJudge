/** Strict task-scoped persistence for editable Pictionary text drafts. */

import { storage } from '@/services/infra/localStorage';

import {
  createPictionaryTaskDraftStorageKey,
  hasSamePictionaryTaskDraftScope,
  parsePictionaryTaskDraftScope,
  type PictionaryTaskDraftScope,
} from './pictionaryTaskDraftScope';

const STORAGE_KEY_PREFIX = '@pictionary:text-draft:';
const STORAGE_VERSION = 1;
export const PICTIONARY_TEXT_DRAFT_MAX_CODE_UNITS = 512;

interface TextDraftStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

interface StoredPictionaryTextDraft {
  readonly version: 1;
  readonly scope: PictionaryTaskDraftScope;
  readonly text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseText(value: unknown): string {
  if (typeof value !== 'string' || value.length > PICTIONARY_TEXT_DRAFT_MAX_CODE_UNITS) {
    throw new Error('Stored Pictionary text draft is invalid');
  }
  return value;
}

function parseStoredDraft(value: unknown): StoredPictionaryTextDraft {
  if (!isRecord(value)) throw new Error('Stored Pictionary text draft must be an object');
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = ['scope', 'text', 'version'];
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error('Stored Pictionary text draft has unsupported fields');
  }
  if (value.version !== STORAGE_VERSION) {
    throw new Error('Stored Pictionary text draft has an unsupported version');
  }
  return {
    version: STORAGE_VERSION,
    scope: parsePictionaryTaskDraftScope(value.scope),
    text: parseText(value.text),
  };
}

/** Persists independent editable text for each user-owned relay task. */
class PictionaryTextDraftStore {
  readonly #storage: TextDraftStorage;

  constructor(textDraftStorage: TextDraftStorage = storage) {
    this.#storage = textDraftStorage;
  }

  /** Read only a draft with the exact requested task identity. */
  read(scope: PictionaryTaskDraftScope): string | null {
    const canonicalScope = parsePictionaryTaskDraftScope(scope);
    const raw = this.#storage.getString(
      createPictionaryTaskDraftStorageKey(STORAGE_KEY_PREFIX, canonicalScope),
    );
    if (raw === undefined) return null;
    const storedValue: unknown = JSON.parse(raw);
    const stored = parseStoredDraft(storedValue);
    if (!hasSamePictionaryTaskDraftScope(stored.scope, canonicalScope)) {
      throw new Error('Stored Pictionary text draft scope does not match its key');
    }
    return stored.text;
  }

  /** Replace the current task text, removing storage for an empty draft. */
  write(scope: PictionaryTaskDraftScope, text: string): void {
    const canonicalScope = parsePictionaryTaskDraftScope(scope);
    const canonicalText = parseText(text);
    if (canonicalText.length === 0) {
      this.clear(canonicalScope);
      return;
    }
    const stored: StoredPictionaryTextDraft = {
      version: STORAGE_VERSION,
      scope: canonicalScope,
      text: canonicalText,
    };
    this.#storage.set(
      createPictionaryTaskDraftStorageKey(STORAGE_KEY_PREFIX, canonicalScope),
      JSON.stringify(stored),
    );
  }

  /** Remove one task's local text draft. */
  clear(scope: PictionaryTaskDraftScope): void {
    this.#storage.remove(
      createPictionaryTaskDraftStorageKey(STORAGE_KEY_PREFIX, parsePictionaryTaskDraftScope(scope)),
    );
  }
}

export const pictionaryTextDraftStore = new PictionaryTextDraftStore();
