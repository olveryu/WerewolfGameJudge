/**
 * Werewolf settlement effects — XP/gacha settlement and retry alarm handling.
 */

import { WEREWOLF_ACTION } from '@werewolf/game-engine/werewolf/actions';
import { werewolfEngine } from '@werewolf/game-engine/werewolf/engine';
import { GameStatus } from '@werewolf/game-engine/werewolf/models/GameStatus';
import type { WerewolfState } from '@werewolf/game-engine/werewolf/protocol/types';
import type { StateAction } from '@werewolf/game-engine/werewolf/reducer/types';

import { type PlayerSettleResult, settleGameResults } from '../../growth/settleGameResults';
import { createLogger } from '../../lib/logger';
import { applyEngineActions, type DispatchResult } from '../processEngineAction';
import { isWebSocketAttachment } from '../webSocketAttachment';
import type { EngineEffectContext, EnginePostCommitContext } from './types';

const log = createLogger('WerewolfSettlementEffects');

const SETTLE_PENDING_KEY = 'werewolf:settle_pending';
const SETTLE_MAX_RETRIES = 3;
const SETTLE_RETRY_DELAY_MS = 30_000;

interface SettlePending {
  readonly revision: number;
  readonly attempt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEndedWerewolfState(value: unknown): value is WerewolfState {
  if (!isRecord(value)) return false;
  return (
    value.status === GameStatus.Ended &&
    typeof value.roomCode === 'string' &&
    typeof value.hostUserId === 'string' &&
    isRecord(value.players) &&
    isRecord(value.roster)
  );
}

function isSettlePending(value: unknown): value is SettlePending {
  if (!isRecord(value)) return false;
  return typeof value.revision === 'number' && typeof value.attempt === 'number';
}

async function scheduleSettleRetry(
  storage: DurableObjectState['storage'],
  revision: number,
  attempt: number,
): Promise<void> {
  if (attempt >= SETTLE_MAX_RETRIES) {
    log.error('settle retries exhausted', { revision, attempt });
    return;
  }
  await storage.put(SETTLE_PENDING_KEY, { revision, attempt });
  await storage.setAlarm(Date.now() + SETTLE_RETRY_DELAY_MS);
}

function sendSettleResults(context: EngineEffectContext, results: PlayerSettleResult[]): void {
  if (results.length === 0) return;
  const resultByUid = new Map(results.map((result) => [result.userId, result]));
  for (const ws of context.getWebSockets()) {
    const attachment: unknown = ws.deserializeAttachment();
    if (!isWebSocketAttachment(attachment)) {
      log.warn('skip settlement send: invalid websocket attachment');
      continue;
    }

    const settle = resultByUid.get(attachment.userId);
    if (!settle) continue;
    try {
      ws.send(
        JSON.stringify({
          type: 'SETTLE_RESULT',
          xpEarned: settle.xpEarned,
          newXp: settle.newXp,
          newLevel: settle.newLevel,
          previousLevel: settle.previousLevel,
          normalDrawsEarned: settle.normalDrawsEarned,
          goldenDrawsEarned: settle.goldenDrawsEarned,
        }),
      );
    } catch (err) {
      log.warn('skip settlement send: websocket send failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function updateRosterLevels(context: EngineEffectContext, results: PlayerSettleResult[]): void {
  if (results.length === 0) return;

  const levels: Record<string, number> = {};
  for (const result of results) {
    levels[result.userId] = result.newLevel;
  }

  const action: StateAction = {
    type: 'UPDATE_ROSTER_LEVELS',
    payload: { levels },
  };
  const updateResult = applyEngineActions(context.storage.sql, werewolfEngine, [action]);
  if (updateResult.state !== undefined && updateResult.revision != null) {
    context.broadcast(updateResult.state, updateResult.revision);
  }
}

async function runSettle(
  state: WerewolfState,
  revision: number,
  context: EngineEffectContext,
): Promise<void> {
  const settleResults = await settleGameResults(state, context.env, revision);
  sendSettleResults(context, settleResults);
  updateRosterLevels(context, settleResults);
}

export async function runWerewolfPostCommitEffects(
  result: DispatchResult,
  context: EnginePostCommitContext,
): Promise<void> {
  if (context.trigger.actionType !== WEREWOLF_ACTION.AUDIO_ACK) return;
  if (!result.success || result.revision == null || !isEndedWerewolfState(result.state)) return;

  try {
    await runSettle(result.state, result.revision, context);
    await context.storage.delete(SETTLE_PENDING_KEY);
  } catch (err) {
    log.error('settleGameResults failed, scheduling retry', {
      error: err instanceof Error ? err.message : String(err),
    });
    await scheduleSettleRetry(context.storage, result.revision, 0);
  }
}

export async function runWerewolfAlarm(context: EngineEffectContext): Promise<void> {
  const pendingValue = await context.storage.get(SETTLE_PENDING_KEY);
  if (!pendingValue) return;
  if (!isSettlePending(pendingValue)) {
    log.error('invalid settle pending payload');
    await context.storage.delete(SETTLE_PENDING_KEY);
    return;
  }

  const rows = context.storage.sql.exec('SELECT game_state FROM room_state WHERE id = 1').toArray();
  if (rows.length === 0) {
    await context.storage.delete(SETTLE_PENDING_KEY);
    return;
  }

  const gameStateJson = rows[0].game_state;
  if (typeof gameStateJson !== 'string') {
    throw new Error('[FAIL-FAST] room_state.game_state must be a JSON string');
  }
  const state: unknown = JSON.parse(gameStateJson);
  if (!isEndedWerewolfState(state)) {
    await context.storage.delete(SETTLE_PENDING_KEY);
    return;
  }

  try {
    await runSettle(state, pendingValue.revision, context);
    await context.storage.delete(SETTLE_PENDING_KEY);
  } catch (err) {
    log.error('settle retry failed', {
      revision: pendingValue.revision,
      attempt: pendingValue.attempt,
      error: err instanceof Error ? err.message : String(err),
    });
    await scheduleSettleRetry(context.storage, pendingValue.revision, pendingValue.attempt + 1);
  }
}
