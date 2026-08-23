/** Strict persistence for unconfirmed Werewolf seat selections. */

import { isValidSchemaId, type SchemaId } from '@game-judge/game-engine/games/werewolf/public';
import { parseRoomId } from '@game-judge/game-engine/platform/protocol/roomLocator';

import { storage } from '@/services/infra/localStorage';

const STORAGE_KEY_PREFIX = '@werewolf:action-draft:';
const STORAGE_VERSION = 1;
const MAX_USER_ID_LENGTH = 128;
const MAX_NONCE_LENGTH = 128;

type JsonObject = Record<string, unknown>;

interface ActionDraftStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

interface StoredWerewolfActionDraft {
  readonly version: 1;
  readonly scope: WerewolfActionDraftScope;
  readonly draft: WerewolfActionDraft;
}

export interface WerewolfActionDraftScope {
  readonly roomId: string;
  readonly userId: string;
  readonly currentStepId: SchemaId;
  readonly currentStepIndex: number;
  readonly roleRevealRandomNonce: string | null;
  readonly actorSeat: number;
}

export interface WerewolfActionDraft {
  readonly firstSwapSeat: number | null;
  readonly multiSelectedSeats: readonly number[];
}

export type WerewolfActionDraftReadResult =
  | { readonly kind: 'missing' | 'stale' }
  | { readonly kind: 'found'; readonly draft: WerewolfActionDraft };

export interface WerewolfActionDraftRepository {
  read(scope: WerewolfActionDraftScope, seatCount: number): WerewolfActionDraftReadResult;
  write(scope: WerewolfActionDraftScope, seatCount: number, draft: WerewolfActionDraft): void;
  clear(scope: Pick<WerewolfActionDraftScope, 'roomId' | 'userId'>): void;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): JsonObject {
  if (!isJsonObject(value)) throw new Error(`${label} must be an object`);
  return value;
}

function assertExactKeys(value: JsonObject, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const canonicalExpected = [...expected].sort();
  if (
    actual.length !== canonicalExpected.length ||
    actual.some((key, index) => key !== canonicalExpected[index])
  ) {
    throw new Error(`${label} has unsupported fields`);
  }
}

function requireUserId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_USER_ID_LENGTH) {
    throw new Error('Werewolf action draft user ID is invalid');
  }
  return value;
}

function requireSeatCount(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Werewolf action draft seat count must be a positive safe integer');
  }
  return value;
}

function parseSeatIndex(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function validateSeatForBoard(value: number, label: string, seatCount: number): number {
  if (value >= seatCount) {
    throw new Error(`${label} must be a seat index within the current board`);
  }
  return value;
}

function parseScope(value: unknown): WerewolfActionDraftScope {
  const scope = requireObject(value, 'Stored Werewolf action draft scope');
  assertExactKeys(
    scope,
    ['roomId', 'userId', 'currentStepId', 'currentStepIndex', 'roleRevealRandomNonce', 'actorSeat'],
    'Stored Werewolf action draft scope',
  );
  if (typeof scope.currentStepId !== 'string' || !isValidSchemaId(scope.currentStepId)) {
    throw new Error('Stored Werewolf action draft step ID is invalid');
  }
  if (
    typeof scope.currentStepIndex !== 'number' ||
    !Number.isSafeInteger(scope.currentStepIndex) ||
    scope.currentStepIndex < 0
  ) {
    throw new Error('Stored Werewolf action draft step index is invalid');
  }
  if (
    scope.roleRevealRandomNonce !== null &&
    (typeof scope.roleRevealRandomNonce !== 'string' ||
      scope.roleRevealRandomNonce.length === 0 ||
      scope.roleRevealRandomNonce.length > MAX_NONCE_LENGTH)
  ) {
    throw new Error('Stored Werewolf action draft round nonce is invalid');
  }
  return {
    roomId: parseRoomId(scope.roomId),
    userId: requireUserId(scope.userId),
    currentStepId: scope.currentStepId,
    currentStepIndex: scope.currentStepIndex,
    roleRevealRandomNonce: scope.roleRevealRandomNonce,
    actorSeat: parseSeatIndex(scope.actorSeat, 'Stored Werewolf action draft actor'),
  };
}

function parseDraft(value: unknown): WerewolfActionDraft {
  const draft = requireObject(value, 'Stored Werewolf action draft');
  assertExactKeys(draft, ['firstSwapSeat', 'multiSelectedSeats'], 'Stored Werewolf action draft');
  const firstSwapSeat =
    draft.firstSwapSeat === null
      ? null
      : parseSeatIndex(draft.firstSwapSeat, 'Stored Werewolf first swap seat');
  if (!Array.isArray(draft.multiSelectedSeats)) {
    throw new Error('Stored Werewolf multi-seat selection is invalid');
  }
  const multiSelectedSeats = draft.multiSelectedSeats.map((seat, index) =>
    parseSeatIndex(seat, `Stored Werewolf multi-seat selection ${index}`),
  );
  if (new Set(multiSelectedSeats).size !== multiSelectedSeats.length) {
    throw new Error('Stored Werewolf multi-seat selection contains duplicate seats');
  }
  return { firstSwapSeat, multiSelectedSeats };
}

function parseStoredDraft(value: unknown): StoredWerewolfActionDraft {
  const stored = requireObject(value, 'Stored Werewolf action draft envelope');
  assertExactKeys(stored, ['version', 'scope', 'draft'], 'Stored Werewolf action draft envelope');
  if (stored.version !== STORAGE_VERSION) {
    throw new Error('Stored Werewolf action draft has an unsupported version');
  }
  return {
    version: STORAGE_VERSION,
    scope: parseScope(stored.scope),
    draft: parseDraft(stored.draft),
  };
}

function validateScopeForBoard(
  scope: WerewolfActionDraftScope,
  seatCount: number,
): WerewolfActionDraftScope {
  validateSeatForBoard(scope.actorSeat, 'Stored Werewolf action draft actor', seatCount);
  return scope;
}

function validateDraftForBoard(draft: WerewolfActionDraft, seatCount: number): WerewolfActionDraft {
  if (draft.multiSelectedSeats.length > seatCount) {
    throw new Error('Stored Werewolf multi-seat selection is invalid');
  }
  if (draft.firstSwapSeat !== null) {
    validateSeatForBoard(draft.firstSwapSeat, 'Stored Werewolf first swap seat', seatCount);
  }
  draft.multiSelectedSeats.forEach((seat, index) => {
    validateSeatForBoard(seat, `Stored Werewolf multi-seat selection ${index}`, seatCount);
  });
  return draft;
}

function hasSameScope(first: WerewolfActionDraftScope, second: WerewolfActionDraftScope): boolean {
  return (
    first.roomId === second.roomId &&
    first.userId === second.userId &&
    first.currentStepId === second.currentStepId &&
    first.currentStepIndex === second.currentStepIndex &&
    first.roleRevealRandomNonce === second.roleRevealRandomNonce &&
    first.actorSeat === second.actorSeat
  );
}

function getStorageKey(scope: Pick<WerewolfActionDraftScope, 'roomId' | 'userId'>): string {
  const roomId = encodeURIComponent(parseRoomId(scope.roomId));
  const userId = encodeURIComponent(requireUserId(scope.userId));
  return `${STORAGE_KEY_PREFIX}${userId}:${roomId}`;
}

function isEmptyDraft(draft: WerewolfActionDraft): boolean {
  return draft.firstSwapSeat === null && draft.multiSelectedSeats.length === 0;
}

/** Stores only unconfirmed UI choices; it never stores or dispatches a room command. */
export class WerewolfActionDraftStore implements WerewolfActionDraftRepository {
  readonly #storage: ActionDraftStorage;

  constructor(actionDraftStorage: ActionDraftStorage = storage) {
    this.#storage = actionDraftStorage;
  }

  /** Read a draft only when every room, round, step, and actor token still matches. */
  read(scope: WerewolfActionDraftScope, seatCount: number): WerewolfActionDraftReadResult {
    const canonicalSeatCount = requireSeatCount(seatCount);
    const canonicalScope = validateScopeForBoard(parseScope(scope), canonicalSeatCount);
    const raw = this.#storage.getString(getStorageKey(canonicalScope));
    if (raw === undefined) return { kind: 'missing' };
    const parsed: unknown = JSON.parse(raw);
    const stored = parseStoredDraft(parsed);
    if (!hasSameScope(stored.scope, canonicalScope)) return { kind: 'stale' };
    return {
      kind: 'found',
      draft: validateDraftForBoard(stored.draft, canonicalSeatCount),
    };
  }

  /** Replace the current draft, or remove storage when no seat remains selected. */
  write(scope: WerewolfActionDraftScope, seatCount: number, draft: WerewolfActionDraft): void {
    const canonicalSeatCount = requireSeatCount(seatCount);
    const stored: StoredWerewolfActionDraft = {
      version: STORAGE_VERSION,
      scope: validateScopeForBoard(parseScope(scope), canonicalSeatCount),
      draft: validateDraftForBoard(parseDraft(draft), canonicalSeatCount),
    };
    if (isEmptyDraft(stored.draft)) {
      this.clear(stored.scope);
      return;
    }
    this.#storage.set(getStorageKey(stored.scope), JSON.stringify(stored));
  }

  /** Remove the latest draft for exactly one room instance and user. */
  clear(scope: Pick<WerewolfActionDraftScope, 'roomId' | 'userId'>): void {
    this.#storage.remove(getStorageKey(scope));
  }
}

export const werewolfActionDraftStore = new WerewolfActionDraftStore();
