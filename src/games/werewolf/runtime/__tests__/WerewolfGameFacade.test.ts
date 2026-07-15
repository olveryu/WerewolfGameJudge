import type { WerewolfPublicCommand } from '@werewolf/game-engine/games/werewolf/public';
import type { RoleId } from '@werewolf/game-engine/games/werewolf/public';
import type { GameState } from '@werewolf/game-engine/games/werewolf/public';
import { GameStatus } from '@werewolf/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type {
  PreparedRoomCommand,
  RoomSessionClient,
  RoomSessionSnapshot,
} from '@/features/room/session/types';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { WerewolfUserEvent } from '@/games/werewolf/realtime/werewolfUserEventCodec';

import { WerewolfGameFacade } from '../WerewolfGameFacade';
import { buildApiTestState } from './apiTestState';

const room: RoomRecord = {
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
    snapshot: null,
    lastCommand: null,
    error: null,
  };
  let commandSequence = 0;
  const dispatch = jest.fn(async (_command: WerewolfPublicCommand) => {
    commandSequence += 1;
    const commandId = `command-${commandSequence}`;
    if (snapshot.phase !== 'ready') throw new Error('test session is not ready');
    return {
      kind: 'decided' as const,
      decision: {
        kind: 'committed' as const,
        commandId,
        snapshot: snapshot.snapshot,
        outcome: { kind: 'success' as const },
      },
    };
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
    snapshot: null,
    lastCommand: null,
    error: null,
  };
}

function readySnapshot(status: GameStatus, userId = 'host-user'): RoomSessionSnapshot<GameState> {
  const state = buildApiTestState({
    roomCode: room.roomCode,
    hostUserId: room.hostUserId,
    status,
  });
  return {
    phase: 'ready',
    epoch: 1,
    identity: { room, userId },
    connection: 'live',
    snapshot: createRoomSnapshot(state, 1),
    lastCommand: null,
    error: null,
  };
}

function createFacade() {
  const roomSession = createRoomSession();
  const audio = createAudio();
  const facade = new WerewolfGameFacade({ roomSession: roomSession.session, audio });
  return { facade, roomSession, audio };
}

describe('WerewolfGameFacade composition', () => {
  it('derives host rejoin audio recovery from shared session transitions', () => {
    const { facade, roomSession } = createFacade();

    roomSession.emit(enteringSnapshot());
    roomSession.emit(readySnapshot(GameStatus.Ongoing));

    expect(facade.wasAudioInterrupted).toBe(true);
  });

  it('does not mark a non-host entry as interrupted', () => {
    const { facade, roomSession } = createFacade();

    roomSession.emit(enteringSnapshot('player-user'));
    roomSession.emit(readySnapshot(GameStatus.Ongoing, 'player-user'));

    expect(facade.wasAudioInterrupted).toBe(false);
  });

  it('stops prepared audio before dispatching a Werewolf restart command', async () => {
    const { facade, roomSession, audio } = createFacade();
    roomSession.emit(enteringSnapshot());
    roomSession.emit(readySnapshot(GameStatus.Seated));

    await facade.restartGame();

    expect(audio.stopNarration).toHaveBeenCalledTimes(1);
    expect(audio.clearPreloaded).toHaveBeenCalledTimes(1);
    expect(roomSession.dispatch).toHaveBeenCalledWith(
      { type: 'werewolf.game.restart' },
      { controlledSeat: null, label: 'restartGame' },
    );
  });

  it('reacts to session teardown without owning disconnect', () => {
    const { roomSession, audio } = createFacade();
    roomSession.emit(enteringSnapshot());
    roomSession.emit(readySnapshot(GameStatus.Seated));

    roomSession.emit({
      phase: 'idle',
      epoch: 2,
      identity: null,
      connection: 'disconnected',
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
