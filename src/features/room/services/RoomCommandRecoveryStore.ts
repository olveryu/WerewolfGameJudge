/** Strict persistent store for confirmed room commands awaiting an authoritative decision. */

import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';

import { ROOM_COMMAND_RECOVERY_KEY } from '@/config/storageKeys';
import { storage } from '@/services/infra/localStorage';

const RECOVERABLE_COMMAND_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_RECOVERABLE_COMMANDS = 20;
const MAX_ID_LENGTH = 128;
const MAX_ROOM_CODE_LENGTH = 16;
const MAX_LABEL_LENGTH = 128;
const MAX_COMMAND_JSON_LENGTH = 64 * 1_024;

type JsonObject = Record<string, unknown>;

interface StoredRecoverableRoomCommand {
  readonly roomCode: string;
  readonly roomId: string;
  readonly userId: string;
  readonly commandId: string;
  readonly commandJson: string;
  readonly controlledSeat: number | null;
  readonly label: string;
  readonly createdAtMs: number;
}

interface StoredRoomCommandRecoveryState {
  readonly version: 1;
  readonly commands: readonly StoredRecoverableRoomCommand[];
}

interface RoomCommandRecoveryStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface RecoverableRoomCommand {
  readonly roomCode: string;
  readonly roomId: string;
  readonly userId: string;
  readonly commandId: string;
  readonly command: Readonly<JsonObject>;
  readonly controlledSeat: number | null;
  readonly label: string;
  readonly createdAtMs: number;
}

export interface NewRecoverableRoomCommand {
  readonly roomCode: string;
  readonly roomId: string;
  readonly userId: string;
  readonly commandId: string;
  readonly command: Readonly<object>;
  readonly controlledSeat: number | null;
  readonly label: string;
}

export interface RoomCommandRecoveryRepository {
  load(roomId: string, userId: string): readonly RecoverableRoomCommand[];
  save(command: NewRecoverableRoomCommand): void;
  remove(roomId: string, userId: string, commandId: string): void;
}

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

function parseBoundedString(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximumLength) {
    throw new Error(`${label} must be a non-empty string of at most ${maximumLength} characters`);
  }
  return value;
}

function parseControlledSeat(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || typeof value !== 'number' || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer or null`);
  }
  return value;
}

function parseCommandJson(
  value: unknown,
  label: string,
): {
  readonly commandJson: string;
  readonly command: Readonly<JsonObject>;
} {
  const commandJson = parseBoundedString(value, label, MAX_COMMAND_JSON_LENGTH);
  const parsed: unknown = JSON.parse(commandJson);
  if (!isJsonObject(parsed)) throw new Error(`${label} must encode a JSON object`);
  if (canonicalJson(parsed) !== commandJson) {
    throw new Error(`${label} must use canonical JSON encoding`);
  }
  return { commandJson, command: parsed };
}

function parseStoredCommand(value: unknown, index: number): StoredRecoverableRoomCommand {
  const label = `Stored recoverable room command ${index}`;
  if (!isJsonObject(value)) throw new Error(`${label} must be an object`);
  assertExactKeys(
    value,
    [
      'roomCode',
      'roomId',
      'userId',
      'commandId',
      'commandJson',
      'controlledSeat',
      'label',
      'createdAtMs',
    ],
    label,
  );
  const commandJson = parseCommandJson(value.commandJson, `${label} command`).commandJson;
  if (
    typeof value.createdAtMs !== 'number' ||
    !Number.isSafeInteger(value.createdAtMs) ||
    value.createdAtMs < 0
  ) {
    throw new Error(`${label} has an invalid creation time`);
  }
  return {
    roomCode: parseBoundedString(value.roomCode, `${label} room code`, MAX_ROOM_CODE_LENGTH),
    roomId: parseBoundedString(value.roomId, `${label} room ID`, MAX_ID_LENGTH),
    userId: parseBoundedString(value.userId, `${label} user ID`, MAX_ID_LENGTH),
    commandId: parseBoundedString(value.commandId, `${label} command ID`, MAX_ID_LENGTH),
    commandJson,
    controlledSeat: parseControlledSeat(value.controlledSeat, `${label} controlled seat`),
    label: parseBoundedString(value.label, `${label} label`, MAX_LABEL_LENGTH),
    createdAtMs: value.createdAtMs,
  };
}

function parseStoredState(value: unknown): StoredRoomCommandRecoveryState {
  if (!isJsonObject(value)) throw new Error('Stored room command recovery state must be an object');
  assertExactKeys(value, ['version', 'commands'], 'Stored room command recovery state');
  if (value.version !== 1 || !Array.isArray(value.commands)) {
    throw new Error(
      'Stored room command recovery state has an unsupported version or command list',
    );
  }
  if (value.commands.length > MAX_RECOVERABLE_COMMANDS) {
    throw new Error('Stored room command recovery state exceeds its command limit');
  }
  const commands = value.commands.map(parseStoredCommand);
  if (new Set(commands.map(({ commandId }) => commandId)).size !== commands.length) {
    throw new Error('Stored recoverable room commands contain duplicate command IDs');
  }
  return { version: 1, commands };
}

function toRecoverableRoomCommand(command: StoredRecoverableRoomCommand): RecoverableRoomCommand {
  return {
    roomCode: command.roomCode,
    roomId: command.roomId,
    userId: command.userId,
    commandId: command.commandId,
    command: parseCommandJson(command.commandJson, `Room command ${command.commandId}`).command,
    controlledSeat: command.controlledSeat,
    label: command.label,
    createdAtMs: command.createdAtMs,
  };
}

function hasSameCommandPayload(
  first: StoredRecoverableRoomCommand,
  second: StoredRecoverableRoomCommand,
): boolean {
  return (
    first.roomCode === second.roomCode &&
    first.roomId === second.roomId &&
    first.userId === second.userId &&
    first.commandId === second.commandId &&
    first.commandJson === second.commandJson &&
    first.controlledSeat === second.controlledSeat &&
    first.label === second.label
  );
}

/** Persists exact JSON command payloads until the Worker returns a final decision. */
export class RoomCommandRecoveryStore implements RoomCommandRecoveryRepository {
  readonly #storage: RoomCommandRecoveryStorage;
  readonly #now: () => number;

  constructor(recoveryStorage: RoomCommandRecoveryStorage = storage, now: () => number = Date.now) {
    this.#storage = recoveryStorage;
    this.#now = now;
  }

  /** Load active commands belonging to exactly one room instance and user. */
  load(roomId: string, userId: string): readonly RecoverableRoomCommand[] {
    parseBoundedString(roomId, 'Room command recovery room ID', MAX_ID_LENGTH);
    parseBoundedString(userId, 'Room command recovery user ID', MAX_ID_LENGTH);
    const state = this.#readActiveState();
    return state.commands
      .filter((command) => command.roomId === roomId && command.userId === userId)
      .map(toRecoverableRoomCommand);
  }

  /** Persist a command before its first network send. */
  save(command: NewRecoverableRoomCommand): void {
    if (!isJsonObject(command.command)) {
      throw new Error('Recoverable room command payload must be a JSON object');
    }
    const storedCommand: StoredRecoverableRoomCommand = {
      roomCode: parseBoundedString(command.roomCode, 'Recoverable room code', MAX_ROOM_CODE_LENGTH),
      roomId: parseBoundedString(command.roomId, 'Recoverable room ID', MAX_ID_LENGTH),
      userId: parseBoundedString(command.userId, 'Recoverable user ID', MAX_ID_LENGTH),
      commandId: parseBoundedString(command.commandId, 'Recoverable command ID', MAX_ID_LENGTH),
      commandJson: canonicalJson(command.command),
      controlledSeat: parseControlledSeat(command.controlledSeat, 'Recoverable controlled seat'),
      label: parseBoundedString(command.label, 'Recoverable command label', MAX_LABEL_LENGTH),
      createdAtMs: this.#now(),
    };
    parseCommandJson(storedCommand.commandJson, 'Recoverable room command payload');

    const state = this.#readActiveState();
    const existing = state.commands.find(({ commandId }) => commandId === storedCommand.commandId);
    if (existing !== undefined) {
      if (!hasSameCommandPayload(existing, storedCommand)) {
        throw new Error(
          `Recoverable room command ${storedCommand.commandId} changed after storage`,
        );
      }
      return;
    }
    if (state.commands.length >= MAX_RECOVERABLE_COMMANDS) {
      throw new Error('Recoverable room command limit reached');
    }
    this.#writeState({ version: 1, commands: [...state.commands, storedCommand] });
  }

  /** Remove a decided command; repeated cleanup is intentionally idempotent. */
  remove(roomId: string, userId: string, commandId: string): void {
    parseBoundedString(roomId, 'Room command recovery room ID', MAX_ID_LENGTH);
    parseBoundedString(userId, 'Room command recovery user ID', MAX_ID_LENGTH);
    parseBoundedString(commandId, 'Room command recovery command ID', MAX_ID_LENGTH);
    const state = this.#readActiveState();
    this.#writeState({
      version: 1,
      commands: state.commands.filter(
        (command) =>
          command.roomId !== roomId || command.userId !== userId || command.commandId !== commandId,
      ),
    });
  }

  #readActiveState(): StoredRoomCommandRecoveryState {
    const raw = this.#storage.getString(ROOM_COMMAND_RECOVERY_KEY);
    if (raw === undefined) return { version: 1, commands: [] };
    const parsed: unknown = JSON.parse(raw);
    const state = parseStoredState(parsed);
    const nowMs = this.#now();
    const activeCommands = state.commands.filter(
      ({ createdAtMs }) => nowMs - createdAtMs < RECOVERABLE_COMMAND_RETENTION_MS,
    );
    if (activeCommands.length !== state.commands.length) {
      this.#writeState({ version: 1, commands: activeCommands });
    }
    return { version: 1, commands: activeCommands };
  }

  #writeState(state: StoredRoomCommandRecoveryState): void {
    if (state.commands.length === 0) {
      this.#storage.remove(ROOM_COMMAND_RECOVERY_KEY);
      return;
    }
    this.#storage.set(ROOM_COMMAND_RECOVERY_KEY, JSON.stringify(state));
  }
}
