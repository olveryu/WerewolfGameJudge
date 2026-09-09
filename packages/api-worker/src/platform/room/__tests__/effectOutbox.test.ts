/** Final-delivery interruption remains recoverable until domain terminalization commits. */
import { FIB_STATE_CODEC } from '@game-judge/game-engine/games/fibking/public';
import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';

import { EffectOutbox, OUTBOX_MAX_ATTEMPTS } from '../effectOutbox';
import { initializeRoomStorage } from '../storageSchema';

it('leases exhausted work without prematurely marking it failed', async () => {
  const stub = env.GAME_ROOM.get(env.GAME_ROOM.newUniqueId());
  await runInDurableObject(stub, async (_instance, state) => {
    initializeRoomStorage(state.storage, Date.now());
    state.storage.sql.exec(
      `INSERT INTO effect_outbox (
      id, origin_command_id, scope, game_type, effect_type, business_key, payload_json,
      status, attempt_count, available_at, created_revision, created_at
    ) VALUES ('effect', 'command', 'game', 'fibking', 'fib.word.select', 'round',
      '{"type":"fib.word.select","payload":{"roundId":"round","avoidWords":[]}}',
      'pending', ?, 0, 1, 0)`,
      OUTBOX_MAX_ATTEMPTS,
    );
    const outbox = new EffectOutbox(state.storage);
    const claimed = await outbox.claimNextDue(Date.now());
    expect(claimed.kind).toBe('exhausted');
    if (claimed.kind !== 'exhausted') throw new Error('Expected exhausted claim');
    expect(outbox.hasPendingEffects()).toBe(true);
    expect(await state.storage.getAlarm()).toBe(claimed.effect.availableAt);
    const recovered = await outbox.claimNextDue(claimed.effect.availableAt);
    expect(recovered.kind).toBe('exhausted');
    outbox.markFailed(claimed.effect, new Error('terminal failure'), 2);
    expect(outbox.hasPendingEffects()).toBe(false);
    expect(outbox.hasOutstandingEffects()).toBe(true);
    await outbox.replayFailedEffect('replay', 'effect', 'dependency repaired', () => true);
    await outbox.replayFailedEffect('replay', 'effect', 'dependency repaired', () => true);
    expect(outbox.readReplay('replay')).toMatchObject({
      effect_id: 'effect',
      status: 'pending',
      requested_by: 'admin-token',
    });
    await expect(
      outbox.replayFailedEffect('replay', 'effect', 'different reason', () => true),
    ).rejects.toThrow('identity conflict');
    outbox.markSucceeded('effect');
    expect(outbox.readReplay('replay')).toMatchObject({ effect_id: 'effect', status: 'succeeded' });
    await outbox.replayFailedEffect('replay', 'effect', 'dependency repaired', () => true);
    expect(outbox.hasPendingEffects()).toBe(false);
    await state.storage.deleteAlarm();
  });
});

it.each([OUTBOX_MAX_ATTEMPTS - 1, OUTBOX_MAX_ATTEMPTS])(
  'terminalizes Fib preparation at attempt count %i even without a directory entry',
  async (attemptCount) => {
    const stub = await createPreparingRoom();
    await runInDurableObject(stub, async (instance, state) => {
      state.storage.sql.exec(
        "UPDATE effect_outbox SET attempt_count = ?, available_at = 0 WHERE effect_type = 'fib.word.select'",
        attemptCount,
      );
      await instance.alarm();
      const snapshot = await instance.getSnapshot({
        roomCode: '4321',
        roomId: stub.id.toString(),
        creationId: 'terminal-test',
      });
      expect(FIB_STATE_CODEC.parse(snapshot?.state).phase).toBe('preparationFailed');
      expect(
        state.storage.sql
          .exec(
            "SELECT status, attempt_count FROM effect_outbox WHERE effect_type = 'fib.word.select'",
          )
          .one(),
      ).toEqual({ status: 'failed', attempt_count: OUTBOX_MAX_ATTEMPTS });
      expect(
        state.storage.sql
          .exec(
            "SELECT COUNT(*) AS count FROM command_receipts WHERE command_type = 'fib.round.failPreparation'",
          )
          .one(),
      ).toEqual({ count: 1 });
      await state.storage.deleteAlarm();
    });
  },
);

it('rolls back the terminal command and receipt when marking the outbox failed cannot commit', async () => {
  const stub = await createPreparingRoom();
  await runInDurableObject(stub, async (instance, state) => {
    state.storage.sql.exec(
      "UPDATE effect_outbox SET attempt_count = ?, available_at = 0 WHERE effect_type = 'fib.word.select'",
      OUTBOX_MAX_ATTEMPTS,
    );
    state.storage.sql.exec(
      "CREATE TRIGGER reject_terminal BEFORE UPDATE OF status ON effect_outbox WHEN NEW.status = 'failed' BEGIN SELECT RAISE(ABORT, 'terminal write blocked'); END",
    );
    await expect(instance.alarm()).rejects.toThrow('terminal write blocked');
    const snapshot = await instance.getSnapshot({
      roomCode: '4321',
      roomId: stub.id.toString(),
      creationId: 'terminal-test',
    });
    expect(FIB_STATE_CODEC.parse(snapshot?.state).phase).toBe('preparing');
    expect(
      state.storage.sql
        .exec("SELECT status FROM effect_outbox WHERE effect_type = 'fib.word.select'")
        .one(),
    ).toEqual({ status: 'pending' });
    expect(
      state.storage.sql
        .exec(
          "SELECT COUNT(*) AS count FROM command_receipts WHERE command_type = 'fib.round.failPreparation'",
        )
        .one(),
    ).toEqual({ count: 0 });
    expect(await state.storage.getAlarm()).not.toBeNull();
    state.storage.sql.exec('DROP TRIGGER reject_terminal');
    state.storage.sql.exec(
      "UPDATE effect_outbox SET available_at = 0 WHERE effect_type = 'fib.word.select'",
    );
    await instance.alarm();
    expect(
      state.storage.sql
        .exec("SELECT status FROM effect_outbox WHERE effect_type = 'fib.word.select'")
        .one(),
    ).toEqual({ status: 'failed' });
    await state.storage.deleteAlarm();
  });
});

async function createPreparingRoom() {
  const stub = env.GAME_ROOM.get(env.GAME_ROOM.newUniqueId());
  const identity = { roomCode: '4321', roomId: stub.id.toString(), creationId: 'terminal-test' };
  await stub.initializeRoom({
    ...identity,
    gameType: 'fibking',
    hostUserId: 'host',
    config: { numberOfPlayers: 4 },
  });
  for (const command of [{ type: 'room.seat.fillBots' }, { type: 'fib.round.start' }]) {
    const result = await stub.dispatchUserCommand({
      ...identity,
      actorUserId: 'host',
      controlledSeat: null,
      commandId: command.type,
      command,
    });
    if (result.kind !== 'decided' || result.result.kind !== 'committed')
      throw new Error('Preparing fixture command failed');
  }
  return stub;
}
