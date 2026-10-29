import type { WerewolfPublicCommand } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { LinkSnapshot, RoomLink } from '@/platform/realtime/types';
import {
  enteringLinkSnapshot,
  idleLinkSnapshot,
  readyLinkSnapshot,
} from '@/test-utils/linkSnapshot';
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
  let snapshot: LinkSnapshot<GameState> = idleLinkSnapshot<GameState>();
  let commandSequence = 0;
  const dispatch = jest.fn(async (_command: WerewolfPublicCommand) => {
    commandSequence += 1;
    const commandId = `command-${commandSequence}`;
    if (snapshot.phase !== 'ready') throw new Error('test session is not ready');
    return successfulRoomCommand(snapshot.room.state, commandId, snapshot.room.revision + 1);
  });
  const session: RoomLink<GameState, WerewolfPublicCommand> = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect: async () => undefined,
    dispatch,
    retryNow: jest.fn(),
    close: jest.fn(),
  };

  return {
    session,
    dispatch,
    emit(next: LinkSnapshot<GameState>) {
      snapshot = next;
      for (const listener of listeners) listener();
    },
  };
}

function enteringSnapshot(userId = 'host-user'): LinkSnapshot<GameState> {
  return enteringLinkSnapshot<GameState>({ room, userId });
}

function readySnapshot(status: GameStatus, userId = 'host-user'): LinkSnapshot<GameState> {
  const state = buildWerewolfTestState({
    roomCode: room.roomCode,
    hostUserId: room.hostUserId,
    status,
  });
  return readyLinkSnapshot<GameState>({ room, userId }, createRoomSnapshot(state, 1));
}

/** Host reconnects mid-night: the current step's batch is still gated on the server. */
function interruptedNightSnapshot(audioBatchId: number): LinkSnapshot<GameState> {
  const state = buildWerewolfTestState({
    roomCode: room.roomCode,
    hostUserId: room.hostUserId,
    status: GameStatus.Ongoing,
    nightStep: { kind: 'inStep', stepId: 'seerCheck' },
    isAudioPlaying: true,
    audioBatchId,
    pendingAudioEffects: [{ audioKey: 'seer' }],
  });
  return readyLinkSnapshot<GameState>({ room, userId: 'host-user' }, createRoomSnapshot(state, 1));
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

  it('resume after rejoin replays the current step and acks the interrupted batch by id', async () => {
    const { client, roomSession, audio } = createClient();
    roomSession.emit(enteringSnapshot());
    roomSession.emit(interruptedNightSnapshot(3));
    expect(client.wasAudioInterrupted).toBe(true);
    // The interrupted batch must not auto-play; only the user's resume gesture replays it.
    expect(audio.playBeginning).not.toHaveBeenCalled();

    await client.resumeAfterRejoin();

    expect(audio.playBeginning).toHaveBeenCalledWith('seer');
    expect(roomSession.dispatch).toHaveBeenCalledTimes(1);
    expect(roomSession.dispatch).toHaveBeenCalledWith(
      { type: 'werewolf.audio.ack', audioBatchId: 3 },
      { controlledSeat: null, label: '音频确认', durable: true },
    );
  });

  it('stops prepared audio before dispatching a Werewolf abort command', async () => {
    const { client, roomSession, audio } = createClient();
    roomSession.emit(enteringSnapshot());
    roomSession.emit(readySnapshot(GameStatus.Seated));

    await client.abortGame();

    expect(audio.stopNarration).toHaveBeenCalledTimes(1);
    expect(audio.clearPreloaded).toHaveBeenCalledTimes(1);
    expect(roomSession.dispatch).toHaveBeenCalledWith(
      { type: 'werewolf.game.abort' },
      { controlledSeat: null, label: '中止本局', durable: false },
    );
  });

  it('stops prepared audio before dispatching a Werewolf return-to-lobby command', async () => {
    const { client, roomSession, audio } = createClient();
    roomSession.emit(enteringSnapshot());
    roomSession.emit(readySnapshot(GameStatus.Ended));

    await client.returnToLobby();

    expect(audio.stopNarration).toHaveBeenCalledTimes(1);
    expect(audio.clearPreloaded).toHaveBeenCalledTimes(1);
    expect(roomSession.dispatch).toHaveBeenCalledWith(
      { type: 'werewolf.game.returnToLobby' },
      { controlledSeat: null, label: '返回大厅', durable: false },
    );
  });

  it('stops prepared audio before dispatching a Werewolf redeal command', async () => {
    const { client, roomSession, audio } = createClient();
    roomSession.emit(enteringSnapshot());
    roomSession.emit(readySnapshot(GameStatus.Ended));

    await client.redealGame();

    expect(audio.stopNarration).toHaveBeenCalledTimes(1);
    expect(audio.clearPreloaded).toHaveBeenCalledTimes(1);
    expect(roomSession.dispatch).toHaveBeenCalledWith(
      { type: 'werewolf.game.redeal' },
      { controlledSeat: null, label: '再来一局', durable: false },
    );
  });

  it('delegates sheriff election commands with the correct actor metadata', async () => {
    const { client, roomSession } = createClient();
    roomSession.emit(enteringSnapshot());
    roomSession.emit(readySnapshot(GameStatus.Day));

    await client.registerSheriffCandidate(3);
    expect(roomSession.dispatch).toHaveBeenLastCalledWith(
      { type: 'werewolf.sheriff.register' },
      { controlledSeat: 3, label: 'registerSheriffCandidate', durable: false },
    );

    await client.cancelSheriffRegistration(3);
    expect(roomSession.dispatch).toHaveBeenLastCalledWith(
      { type: 'werewolf.sheriff.cancelRegistration' },
      { controlledSeat: 3, label: 'cancelSheriffRegistration', durable: false },
    );

    await client.withdrawSheriffCandidate(3);
    expect(roomSession.dispatch).toHaveBeenLastCalledWith(
      { type: 'werewolf.sheriff.withdraw' },
      { controlledSeat: 3, label: 'withdrawSheriffCandidate', durable: false },
    );

    await client.castSheriffVote(null, 3);
    expect(roomSession.dispatch).toHaveBeenLastCalledWith(
      { type: 'werewolf.sheriff.vote', targetSeat: null },
      { controlledSeat: 3, label: 'castSheriffVote', durable: false },
    );

    await client.advanceSheriffElection();
    expect(roomSession.dispatch).toHaveBeenLastCalledWith(
      { type: 'werewolf.sheriff.advance' },
      { controlledSeat: null, label: 'advanceSheriffElection', durable: false },
    );
  });

  it('reacts to link teardown without owning close', () => {
    const { roomSession, audio } = createClient();
    roomSession.emit(enteringSnapshot());
    roomSession.emit(readySnapshot(GameStatus.Seated));

    roomSession.emit(idleLinkSnapshot<GameState>({ epoch: 2 }));

    expect(audio.stopNarration).toHaveBeenCalledTimes(1);
    expect(audio.stopBgm).toHaveBeenCalledTimes(1);
    expect(audio.clearPreloaded).toHaveBeenCalledTimes(1);
    expect(roomSession.session.close).not.toHaveBeenCalled();
  });
});
