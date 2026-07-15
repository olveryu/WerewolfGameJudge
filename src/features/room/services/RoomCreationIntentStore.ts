/** Strict persistent store for recoverable room-creation IDs. */

import { newRequestId } from '@game-judge/game-engine/platform/identifiers';

import { ROOM_CREATION_INTENTS_KEY } from '@/config/storageKeys';
import { storage } from '@/services/infra/localStorage';

interface StoredCreationIntent {
  readonly intentKey: string;
  readonly creationId: string;
}

interface StoredCreationIntents {
  readonly version: 1;
  readonly intents: readonly StoredCreationIntent[];
}

export interface RoomCreationIntentRepository {
  getOrCreate(intentKey: string): string;
  remove(creationId: string): void;
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function parseStoredCreationIntents(value: unknown): StoredCreationIntents {
  if (!isJsonObject(value)) throw new Error('Stored room creation state must be an object');
  assertExactKeys(value, ['version', 'intents'], 'Stored room creation state');
  if (value.version !== 1 || !Array.isArray(value.intents)) {
    throw new Error('Stored room creation state has an unsupported version or intent list');
  }
  const intents = value.intents.map((intent, index): StoredCreationIntent => {
    if (!isJsonObject(intent)) {
      throw new Error(`Stored room creation intent ${index} must be an object`);
    }
    assertExactKeys(intent, ['intentKey', 'creationId'], `Stored room creation intent ${index}`);
    if (typeof intent.intentKey !== 'string' || intent.intentKey.length === 0) {
      throw new Error(`Stored room creation intent ${index} has an invalid key`);
    }
    if (
      typeof intent.creationId !== 'string' ||
      intent.creationId.length === 0 ||
      intent.creationId.length > 128
    ) {
      throw new Error(`Stored room creation intent ${index} has an invalid creation ID`);
    }
    return { intentKey: intent.intentKey, creationId: intent.creationId };
  });
  if (new Set(intents.map(({ intentKey }) => intentKey)).size !== intents.length) {
    throw new Error('Stored room creation intents contain duplicate keys');
  }
  if (new Set(intents.map(({ creationId }) => creationId)).size !== intents.length) {
    throw new Error('Stored room creation intents contain duplicate creation IDs');
  }
  return { version: 1, intents };
}

function readStoredCreationIntents(): StoredCreationIntents {
  const raw = storage.getString(ROOM_CREATION_INTENTS_KEY);
  if (raw === undefined) return { version: 1, intents: [] };
  const parsed: unknown = JSON.parse(raw);
  return parseStoredCreationIntents(parsed);
}

function writeStoredCreationIntents(state: StoredCreationIntents): void {
  if (state.intents.length === 0) {
    storage.remove(ROOM_CREATION_INTENTS_KEY);
    return;
  }
  storage.set(ROOM_CREATION_INTENTS_KEY, JSON.stringify(state));
}

export class RoomCreationIntentStore implements RoomCreationIntentRepository {
  getOrCreate(intentKey: string): string {
    if (intentKey.length === 0) throw new Error('Room creation intent key must not be empty');
    const stored = readStoredCreationIntents();
    const existing = stored.intents.find((intent) => intent.intentKey === intentKey);
    if (existing !== undefined) return existing.creationId;

    const creationId = newRequestId();
    writeStoredCreationIntents({
      version: 1,
      intents: [...stored.intents, { intentKey, creationId }],
    });
    return creationId;
  }

  remove(creationId: string): void {
    if (creationId.length === 0) throw new Error('Room creation ID must not be empty');
    const stored = readStoredCreationIntents();
    if (!stored.intents.some((intent) => intent.creationId === creationId)) {
      throw new Error(`Room creation intent ${creationId} does not exist`);
    }
    writeStoredCreationIntents({
      version: 1,
      intents: stored.intents.filter((intent) => intent.creationId !== creationId),
    });
  }
}
