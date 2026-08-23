import type { WerewolfPublicCommand } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type {
  PreparedRoomCommand,
  RoomSessionClient,
  RoomSessionSnapshot,
} from '@/features/room/session/types';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { WerewolfUserEvent } from '@/games/werewolf/realtime/werewolfUserEventCodec';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

import { WerewolfGameClientRuntime } from '../WerewolfGameClientRuntime';

const room: RoomRecord<'werewolf'> = {
  roomCode: '1234',
  roomId: 'room-id-1234',
  gameType: 'werewolf',
  hostUserId: 'host-user',
  createdAt: new Date('2026-07-11T12:00:00.000Z'),
};

function createAudio(): jest.Mocked<WerewolfAudioRuntime> {
  return {
    playBeginning: jest.fn(async (_audioKey: string) => undefined),
    playEnding: jest.fn(async (_audioKey: string) => undefined),
    playNight: jest.fn(async () => undefined),
    playNightEnd: jest.fn(async () => undefined),
    preloadRoles: jest.fn(async (_roles: readonly RoleId[]) => undefined),
    stopNarration: jest.fn(),
    stopBgm: jest.fn(),
    clearPreloaded: jest.fn(),
  };
}

function createRoomSession() {
  const listeners = new Set<() => void>();
  let snapshot: RoomSessionSnapshot<GameState> = {
    phase: 'idle',
    epoch: 0,
    identity: null,
    connection: 'disconnected',
    pendingCommandCount: 0,
    lastRecoveredCommandRejection: null,
    snapshot: null,
    lastCommand: null,
    error: null,
  };
  let commandSequence = 0;
  const dispatch = jest.fn(async (_command: WerewolfPublicCommand) => {
    commandSequence += 1;
    const commandId = `command-${commandSequence}`;
    if (snapshot.phase !== 'ready') throw new Error('test session is not ready');
    return successfulRoomCommand(
      snapshot.snapshot.state,
      commandId,
      snapshot.snapshot.revision + 1,
    );
  });
  const session: RoomSessionClient<GameState, WerewolfPublicCommand, WerewolfUserEvent> = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect: async () => ({ kind: 'connected' }),
    reconnect: async () => ({ kind: 'connected' }),
    disconnect: jest.fn(),
    prepare: <TCommand extends WerewolfPublicCommand>(
      command: TCommand,
      controlledSeat: number | null,
    ): PreparedRoomCommand<TCommand> => ({
      sessionEpoch: snapshot.epoch,
      roomCode: room.roomCode,
      roomId: room.roomId,
      commandId: 'prepared-command',
      command,
      controlledSeat,
    }),
    dispatch,
    dispatchPrepared: jest.fn(async () => {
      throw new Error('dispatchPrepared is not used by this test');
    }),
    acknowledgeRecoveredCommandRejection: jest.fn(),
    setUserEventHandler: jest.fn(() => () => undefined),
  };

  return {
    session,
    dispatch,
    emit(next: RoomSessionSnapshot<GameState>) {
      snapshot = next;
      for (const listener of listeners) listener();
    },
  };
}

function enteringSnapshot(userId = 'host-user'): RoomSessionSnapshot<GameState> {
  return {
    phase: 'entering',
    epoch: 1,
    identity: { room, userId },
    connection: 'connecting',
    pendingCommandCount: 0,
    lastRecoveredCommandRejection: null,
    snapshot: null,
    lastCommand: null,
    error: null,
  };
}

function readySnapshot(status: GameStatus, userId = 'host-user'): RoomSessionSnapshot<GameState> {
  const state = buildWerewolfTestState({
    roomCode: room.roomCode,
    hostUserId: room.hostUserId,
    status,
  });
  return {
    phase: 'ready',
    epoch: 1,
    identity: { room, userId },
    connection: 'live',
    pendingCommandCount: 0,
    lastRecoveredCommandRejection: null,
    snapshot: createRoomSnapshot(state, 1),
    lastCommand: null,
    error: null,
  };
}

function createClient() {
  const roomSession = createRoomSession();
  const audio = createAudio();
  const client = new WerewolfGameClientRuntime({ roomSession: roomSession.session, audio });
  return { client, roomSession, audio };
}

describe('WerewolfGameClientRuntime composition', () => {
  it('derives host rejoin audio recovery from shared session transitions', () => {
    const { client, roomSession } = createClient();

    roomSession.emit(enteringSnapshot());
    roomSession.emit(readySnapshot(GameStatus.Ongoing));

    expect(client.wasAudioInterrupted).toBe(true);
  });

  it('does not mark a non-host entry as interrupted', () => {
    const { client, roomSession } = createClient();

    roomSession.emit(enteringSnapshot('player-user'));
    roomSession.emit(readySnapshot(GameStatus.Ongoing, 'player-user'));

    expect(client.wasAudioInterrupted).toBe(false);
  });

  it('stops prepared audio before dispatching a Werewolf restart command', async () => {
    const { client, roomSession, audio } = createClient();
    roomSession.emit(enteringSnapshot());
    roomSession.emit(readySnapshot(GameStatus.Seated));

    await client.restartGame();

    expect(audio.stopNarration).toHaveBeenCalledTimes(1);
    expect(audio.clearPreloaded).toHaveBeenCalledTimes(1);
    expect(roomSession.dispatch).toHaveBeenCalledWith(
      { type: 'werewolf.game.restart' },
      { controlledSeat: null, label: 'restartGame' },
    );
  });

  it('reacts to session teardown without owning disconnect', () => {
    const { roomSession, audio } = createClient();
    roomSession.emit(enteringSnapshot());
    roomSession.emit(readySnapshot(GameStatus.Seated));

    roomSession.emit({
      phase: 'idle',
      epoch: 2,
      identity: null,
      connection: 'disconnected',
      pendingCommandCount: 0,
      lastRecoveredCommandRejection: null,
      snapshot: null,
      lastCommand: null,
      error: null,
    });

    expect(audio.stopNarration).toHaveBeenCalledTimes(1);
    expect(audio.stopBgm).toHaveBeenCalledTimes(1);
    expect(audio.clearPreloaded).toHaveBeenCalledTimes(1);
    expect(roomSession.session.disconnect).not.toHaveBeenCalled();
  });
});
