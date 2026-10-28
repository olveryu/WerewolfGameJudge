/**
 * outboxStorage — persistence for durable room commands.
 *
 * One JSON document per device holding every durable command that has not received a server
 * decision. Records are partitioned by (roomId, userId) at read time. Malformed persisted data
 * is a programming error on this device and throws; it is not silently discarded.
 */
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';

import { ROOM_COMMAND_OUTBOX_KEY } from '@/config/storageKeys';

export interface DurableCommandRecord {
  readonly roomCode: string;
  readonly roomId: string;
  readonly userId: string;
  readonly commandId: string;
  readonly command: Readonly<Record<string, unknown>>;
  readonly controlledSeat: number | null;
  readonly label: string;
  readonly createdAtMs: number;
}

export interface OutboxStorage {
  load(roomId: string, userId: string): readonly DurableCommandRecord[];
  save(record: DurableCommandRecord): void;
  remove(roomId: string, userId: string, commandId: string): void;
}

export interface KeyValueStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const DOCUMENT_VERSION = 2;
/** Durable intents older than this are stale by construction (rooms expire after 24h). */
const RETENTION_MS = 24 * 60 * 60 * 1_000;
const MAX_RECORDS = 50;

interface OutboxDocument {
  readonly version: typeof DOCUMENT_VERSION;
  readonly records: readonly DurableCommandRecord[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Outbox record ${field} must be a non-empty string`);
  }
  return value;
}

function parseRecord(value: unknown): DurableCommandRecord {
  if (!isRecord(value)) throw new Error('Outbox record must be an object');
  const keys = Object.keys(value).sort().join(',');
  if (keys !== 'command,commandId,controlledSeat,createdAtMs,label,roomCode,roomId,userId') {
    throw new Error(`Outbox record has unexpected fields: ${keys}`);
  }
  if (!isRecord(value.command)) throw new Error('Outbox record command must be an object');
  if (value.controlledSeat !== null && !Number.isSafeInteger(value.controlledSeat)) {
    throw new Error('Outbox record controlledSeat must be null or an integer');
  }
  if (!Number.isSafeInteger(value.createdAtMs)) {
    throw new Error('Outbox record createdAtMs must be an integer');
  }
  return {
    roomCode: requireString(value.roomCode, 'roomCode'),
    roomId: requireString(value.roomId, 'roomId'),
    userId: requireString(value.userId, 'userId'),
    commandId: requireString(value.commandId, 'commandId'),
    command: value.command,
    controlledSeat: value.controlledSeat as number | null,
    label: requireString(value.label, 'label'),
    createdAtMs: value.createdAtMs as number,
  };
}

export function createOutboxStorage(storage: KeyValueStorage, now: () => number): OutboxStorage {
  function read(): readonly DurableCommandRecord[] {
    const raw = storage.getString(ROOM_COMMAND_OUTBOX_KEY);
    if (raw === undefined) return [];
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      parsed.version !== DOCUMENT_VERSION ||
      !Array.isArray(parsed.records)
    ) {
      throw new Error('Outbox document is not version 2');
    }
    const cutoff = now() - RETENTION_MS;
    return parsed.records.map(parseRecord).filter((record) => record.createdAtMs >= cutoff);
  }

  function write(records: readonly DurableCommandRecord[]): void {
    if (records.length === 0) {
      storage.remove(ROOM_COMMAND_OUTBOX_KEY);
      return;
    }
    const document: OutboxDocument = { version: DOCUMENT_VERSION, records };
    storage.set(ROOM_COMMAND_OUTBOX_KEY, canonicalJson(document));
  }

  return {
    load: (roomId, userId) =>
      read()
        .filter((record) => record.roomId === roomId && record.userId === userId)
        .sort((a, b) => a.createdAtMs - b.createdAtMs),
    save: (record) => {
      const records = read();
      if (records.some((existing) => existing.commandId === record.commandId)) {
        throw new Error(`[FAIL-FAST] Outbox already holds command ${record.commandId}`);
      }
      if (records.length >= MAX_RECORDS) {
        throw new Error(`[FAIL-FAST] Outbox holds ${MAX_RECORDS} undecided commands`);
      }
      write([...records, record]);
    },
    remove: (roomId, userId, commandId) => {
      write(
        read().filter(
          (record) =>
            !(
              record.roomId === roomId &&
              record.userId === userId &&
              record.commandId === commandId
            ),
        ),
      );
    },
  };
}
