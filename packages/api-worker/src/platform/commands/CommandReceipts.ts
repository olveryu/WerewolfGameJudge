/** `command_receipts`: idempotency ledger binding a command ID to its actor, request and decision. */

import type { CommandActor } from '@game-judge/game-engine/platform/engine';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import type { RoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { type GameType, parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RuntimeWorkerGameModule } from '../gameModules/runtimeGameModule';
import type { DispatchRoomCommand, StoredRoomRow } from '../room/types';
import {
  isRecord,
  parseNonEmptyString,
  parseNonNegativeInteger,
  parsePositiveInteger,
} from './sqlValues';

const COMMAND_RECEIPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

interface RawCommandReceipt extends Record<string, SqlStorageValue> {
  readonly game_type: SqlStorageValue;
  readonly state_version: SqlStorageValue;
  readonly actor_kind: SqlStorageValue;
  readonly actor_id: SqlStorageValue;
  readonly controlled_seat: SqlStorageValue;
  readonly command_type: SqlStorageValue;
  readonly request_json: SqlStorageValue;
  readonly random_seed: SqlStorageValue;
  readonly decision_kind: SqlStorageValue;
  readonly revision: SqlStorageValue;
  readonly result_json: SqlStorageValue;
}

export interface StoredCommandReceipt {
  readonly result: RoomCommandResult<BaseGameState<GameType>>;
  readonly randomSeed: string;
}

export interface NewCommandReceipt {
  readonly request: DispatchRoomCommand;
  readonly requestJson: string;
  readonly room: StoredRoomRow;
  readonly randomSeed: string;
  readonly result: RoomCommandResult<BaseGameState<GameType>>;
  readonly revision: number;
  readonly decidedAt: number;
}

function actorId(actor: CommandActor): string {
  return actor.kind === 'user' ? actor.userId : actor.effectId;
}

function parseActorKind(value: unknown): CommandActor['kind'] {
  if (value === 'user' || value === 'system') return value;
  throw new Error(`command_receipts.actor_kind is invalid: ${String(value)}`);
}

function parseDecisionKind(value: unknown): RoomCommandResult<BaseGameState<GameType>>['kind'] {
  if (value === 'committed' || value === 'rejected') return value;
  throw new Error(`command_receipts.decision_kind is invalid: ${String(value)}`);
}

/** Command type read from the request body; every command object carries a string `type`. */
export function readCommandType(command: unknown): string {
  if (!isRecord(command)) throw new Error('DispatchRoomCommand.command must be an object');
  return parseNonEmptyString(command.type, 'command.type');
}

/** Canonical request identity bound to a receipt: actor, controlled seat and command body. */
export function serializeCommandRequest(request: DispatchRoomCommand): string {
  return canonicalJson({
    actor: request.actor,
    controlledSeat: request.controlledSeat,
    command: request.command,
  });
}

export class CommandReceipts {
  readonly #sql: SqlStorage;

  constructor(sql: SqlStorage) {
    this.#sql = sql;
  }

  /** Expired receipts stay while an outbox effect still references their command. */
  deleteExpired(nowMs: number): void {
    this.#sql.exec(
      `DELETE FROM command_receipts
      WHERE expires_at <= ?
        AND NOT EXISTS (
          SELECT 1 FROM effect_outbox
          WHERE effect_outbox.origin_command_id = command_receipts.command_id
        )`,
      nowMs,
    );
  }

  /** Same ID + same request → stored decision; same ID + different request → 'conflict'. */
  read(
    request: DispatchRoomCommand,
    requestJson: string,
    room: StoredRoomRow,
    module: RuntimeWorkerGameModule,
  ): StoredCommandReceipt | null | 'conflict' {
    const rows = this.#sql
      .exec<RawCommandReceipt>(
        `SELECT game_type, state_version, actor_kind, actor_id, controlled_seat, command_type,
          request_json, random_seed, decision_kind, revision, result_json
        FROM command_receipts WHERE command_id = ?`,
        request.commandId,
      )
      .toArray();
    if (rows.length === 0) return null;
    if (rows.length !== 1) {
      throw new Error(`command_receipts returned ${rows.length} rows for one command ID`);
    }

    const row = rows[0];
    const storedControlledSeat =
      row.controlled_seat === null
        ? null
        : parseNonNegativeInteger(row.controlled_seat, 'command_receipts.controlled_seat');
    if (
      parseGameType(row.game_type) !== room.gameType ||
      parsePositiveInteger(row.state_version, 'command_receipts.state_version') !==
        room.stateVersion ||
      parseActorKind(row.actor_kind) !== request.actor.kind ||
      parseNonEmptyString(row.actor_id, 'command_receipts.actor_id') !== actorId(request.actor) ||
      storedControlledSeat !== request.controlledSeat ||
      parseNonEmptyString(row.command_type, 'command_receipts.command_type') !==
        readCommandType(request.command) ||
      canonicalJson(
        JSON.parse(parseNonEmptyString(row.request_json, 'command_receipts.request_json')),
      ) !== requestJson
    ) {
      return 'conflict';
    }

    const revision = parsePositiveInteger(row.revision, 'command_receipts.revision');
    const result = module.parseCommandResult(
      JSON.parse(parseNonEmptyString(row.result_json, 'command_receipts.result_json')),
    );
    if (
      result.commandId !== request.commandId ||
      result.kind !== parseDecisionKind(row.decision_kind)
    ) {
      throw new Error('Stored command receipt identity does not match its result');
    }
    if (result.kind === 'committed' && result.snapshot.revision !== revision) {
      throw new Error('Stored committed result does not match its receipt revision');
    }
    if (revision > room.revision) {
      throw new Error('Stored command receipt revision is ahead of room state');
    }
    return {
      result,
      randomSeed: parseNonEmptyString(row.random_seed, 'command_receipts.random_seed'),
    };
  }

  /** Insert one receipt; the caller owns the surrounding transaction. */
  insert(receipt: NewCommandReceipt): void {
    this.#sql.exec(
      `INSERT INTO command_receipts (
        command_id, game_type, state_version, actor_kind, actor_id, controlled_seat,
        command_type, request_json, random_seed, decision_kind, revision, result_json,
        created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      receipt.request.commandId,
      receipt.room.gameType,
      receipt.room.stateVersion,
      receipt.request.actor.kind,
      actorId(receipt.request.actor),
      receipt.request.controlledSeat,
      readCommandType(receipt.request.command),
      receipt.requestJson,
      receipt.randomSeed,
      receipt.result.kind,
      receipt.revision,
      JSON.stringify(receipt.result),
      receipt.decidedAt,
      receipt.decidedAt + COMMAND_RECEIPT_RETENTION_MS,
    );
  }
}
