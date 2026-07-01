/**
 * FibFacade — single entry point for the fibking UI.
 *
 * Reuses the game-agnostic transport (ConnectionManager + CFRealtimeService) and the
 * generic /fib/* endpoints and the shared room service. No audio, no settlement, no progression —
 * fibking is a judge/assistant only.
 *
 * The server is the sole authority: every action is an HTTP POST; state arrives via the
 * connection's onStateUpdate → FibStore.applySnapshot (wired by the composition root).
 */

import type { FibStore } from '@werewolf/game-engine/fibking/store/FibStore';
import { FIB_GAME_TYPE, type FibConfig, type FibState } from '@werewolf/game-engine/fibking/types';
import type { RosterEntry } from '@werewolf/game-engine/protocol/common';

import type { ConnectionManager } from '@/services/connection/ConnectionManager';
import { ConnectionState } from '@/services/connection/types';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import type { IRoomService } from '@/services/types/IRoomService';
import { facadeLog } from '@/utils/logger';

import {
  defineRoomAction,
  type RoomActionContext,
  type RoomActionResult,
} from './defineRoomAction';

export type FibActionResult = RoomActionResult;

export interface FibFacadeDeps {
  store: FibStore;
  connectionManager: ConnectionManager<FibState>;
  roomService: IRoomService;
}

function mapConnectionStatus(state: ConnectionState): ConnectionStatus {
  switch (state) {
    case ConnectionState.Connecting:
    case ConnectionState.Reconnecting:
      return ConnectionStatus.Connecting;
    case ConnectionState.Syncing:
      return ConnectionStatus.Syncing;
    case ConnectionState.Connected:
      return ConnectionStatus.Live;
    case ConnectionState.Failed:
      return ConnectionStatus.Failed;
    case ConnectionState.Idle:
    case ConnectionState.Disconnected:
    case ConnectionState.Disposed:
      return ConnectionStatus.Disconnected;
  }
}

const sitAction = defineRoomAction<[seat: number, profile: RosterEntry]>({
  name: 'fib.sit',
  path: '/fib/sit',
  body: (seat, profile) => ({ seat, profile }),
});

const leaveSeatAction = defineRoomAction<[]>({
  name: 'fib.leaveSeat',
  path: '/fib/leave',
});

const kickAction = defineRoomAction<[targetSeat: number]>({
  name: 'fib.kick',
  path: '/fib/kick',
  body: (targetSeat) => ({ targetSeat }),
});

const clearSeatsAction = defineRoomAction<[]>({
  name: 'fib.clearSeats',
  path: '/fib/clear-seats',
});

const fillBotsAction = defineRoomAction<[]>({
  name: 'fib.fillBots',
  path: '/fib/fill-bots',
});

const updateConfigAction = defineRoomAction<[numberOfPlayers: number]>({
  name: 'fib.updateConfig',
  path: '/fib/update-config',
  body: (numberOfPlayers) => ({ numberOfPlayers }),
});

const startRoundAction = defineRoomAction<[]>({
  name: 'fib.startRound',
  path: '/fib/start-round',
});

const nextRoundAction = defineRoomAction<[]>({
  name: 'fib.nextRound',
  path: '/fib/next-round',
});

const revealAction = defineRoomAction<[]>({
  name: 'fib.reveal',
  path: '/fib/reveal',
});

const restartAction = defineRoomAction<[]>({
  name: 'fib.restart',
  path: '/fib/restart',
});

export class FibFacade {
  readonly #store: FibStore;
  readonly #connectionManager: ConnectionManager<FibState>;
  readonly #roomService: IRoomService;
  readonly #roomActionContext: RoomActionContext = {
    getRoomCode: () => this.#roomCodeOrThrow(),
  };
  #myUserId: string | null = null;
  #roomCode: string | null = null;

  constructor(deps: FibFacadeDeps) {
    this.#store = deps.store;
    this.#connectionManager = deps.connectionManager;
    this.#roomService = deps.roomService;
  }

  // ── State access ──────────────────────────────────────────────────────────

  getState(): FibState | null {
    return this.#store.getState();
  }

  getRevision(): number {
    return this.#store.getRevision();
  }

  subscribe(onChange: () => void): () => void {
    return this.#store.subscribe(() => onChange());
  }

  getMyUserId(): string | null {
    return this.#myUserId;
  }

  /** Authoritative host check: cached identity matches the broadcast host. */
  isHost(): boolean {
    return this.#myUserId !== null && this.getState()?.hostUserId === this.#myUserId;
  }

  addConnectionStatusListener(fn: (status: ConnectionStatus) => void): () => void {
    return this.#connectionManager.addStateListener((state) => fn(mapConnectionStatus(state)));
  }

  manualReconnect(): void {
    this.#connectionManager.manualReconnect();
  }

  // ── Room lifecycle ────────────────────────────────────────────────────────

  /** Create a fibking room; FibRoomScreen connects after navigation. */
  async createRoom(
    config: FibConfig,
    hostUserId: string,
    initialRoomNumber?: string,
  ): Promise<string> {
    facadeLog.info('fib createRoom', { numberOfPlayers: config.numberOfPlayers });
    this.#myUserId = hostUserId;
    const record = await this.#roomService.createRoom<FibConfig>({
      gameType: FIB_GAME_TYPE,
      initialRoomNumber,
      maxRetries: 5,
      config,
    });
    this.#roomCode = record.roomCode;
    return record.roomCode;
  }

  /** Connect to a room (join or host rejoin). Idempotent for the already-connected room. */
  async connect(roomCode: string, userId: string): Promise<void> {
    facadeLog.info('fib connect', { roomCode });
    this.#myUserId = userId;
    if (roomCode === this.#roomCode && this.getState()) return; // already connected
    if (roomCode !== this.#roomCode) this.#store.reset();
    this.#roomCode = roomCode;
    await this.#connectionManager.connectAndWait(roomCode, userId);
  }

  async leave(): Promise<void> {
    facadeLog.info('fib leave');
    this.#connectionManager.disconnect();
    this.#store.reset();
    this.#myUserId = null;
    this.#roomCode = null;
  }

  // ── Actions (HTTP POST → server dispatch) ─────────────────────────────────

  #roomCodeOrThrow(): string {
    const roomCode = this.getState()?.roomCode ?? this.#roomCode;
    if (!roomCode) throw new Error('FibFacade: not in a room');
    return roomCode;
  }

  sit(seat: number, profile: RosterEntry): Promise<FibActionResult> {
    return sitAction(this.#roomActionContext, seat, profile);
  }

  leaveSeat(): Promise<FibActionResult> {
    return leaveSeatAction(this.#roomActionContext);
  }

  kick(targetSeat: number): Promise<FibActionResult> {
    return kickAction(this.#roomActionContext, targetSeat);
  }

  clearSeats(): Promise<FibActionResult> {
    return clearSeatsAction(this.#roomActionContext);
  }

  fillBots(): Promise<FibActionResult> {
    return fillBotsAction(this.#roomActionContext);
  }

  updateConfig(numberOfPlayers: number): Promise<FibActionResult> {
    return updateConfigAction(this.#roomActionContext, numberOfPlayers);
  }

  startRound(): Promise<FibActionResult> {
    return startRoundAction(this.#roomActionContext);
  }

  nextRound(): Promise<FibActionResult> {
    return nextRoundAction(this.#roomActionContext);
  }

  reveal(): Promise<FibActionResult> {
    return revealAction(this.#roomActionContext);
  }

  restart(): Promise<FibActionResult> {
    return restartAction(this.#roomActionContext);
  }
}
