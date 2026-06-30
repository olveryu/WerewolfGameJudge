/**
 * FibFacade — single entry point for the fibking UI (parallel to GameFacade).
 *
 * Reuses the game-agnostic transport (ConnectionManager + CFRealtimeService) and the
 * generic /fib/* + /room/create endpoints. No audio, no settlement, no progression —
 * fibking is a judge/assistant only.
 *
 * The server is the sole authority: every action is an HTTP POST; state arrives via the
 * connection's onStateUpdate → FibStore.applySnapshot (wired by the composition root).
 */

import type { FibStore } from '@werewolf/game-engine/fibking/store/FibStore';
import { FIB_GAME_TYPE, type FibConfig, type FibState } from '@werewolf/game-engine/fibking/types';
import type { RosterEntry } from '@werewolf/game-engine/protocol/common';

import { cfPost } from '@/services/cloudflare/cfFetch';
import type { ConnectionManager } from '@/services/connection/ConnectionManager';
import { ConnectionState } from '@/services/connection/types';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import { facadeLog } from '@/utils/logger';
import { generateRoomCode } from '@/utils/roomCode';

export interface FibActionResult {
  success: boolean;
  reason?: string;
}

export interface FibFacadeDeps {
  store: FibStore;
  connectionManager: ConnectionManager;
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

export class FibFacade {
  readonly #store: FibStore;
  readonly #connectionManager: ConnectionManager;
  #myUserId: string | null = null;
  #roomCode: string | null = null;

  constructor(deps: FibFacadeDeps) {
    this.#store = deps.store;
    this.#connectionManager = deps.connectionManager;
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

  /** Create a fibking room (server builds the authoritative initial state) and connect. */
  async createRoom(
    config: FibConfig,
    hostUserId: string,
    initialRoomNumber?: string,
  ): Promise<string> {
    facadeLog.info('fib createRoom', { numberOfPlayers: config.numberOfPlayers });
    this.#myUserId = hostUserId;
    const maxRetries = 5;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const roomCode = attempt === 1 && initialRoomNumber ? initialRoomNumber : generateRoomCode();
      try {
        await cfPost('/room/create', { roomCode, gameType: FIB_GAME_TYPE, config });
        this.#roomCode = roomCode;
        return roomCode;
      } catch (err) {
        const e = err as { status?: number };
        if (e.status === 409 && attempt < maxRetries) continue;
        lastError = err;
        break;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to create fib room');
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

  async #post(path: string, body: Record<string, unknown>): Promise<FibActionResult> {
    try {
      await cfPost(path, body);
      return { success: true };
    } catch (err) {
      const e = err as { reason?: string };
      facadeLog.warn('fib action failed', { path, reason: e.reason });
      return { success: false, reason: e.reason ?? 'REQUEST_FAILED' };
    }
  }

  sit(seat: number, profile: RosterEntry): Promise<FibActionResult> {
    return this.#post('/fib/sit', { roomCode: this.#roomCodeOrThrow(), seat, profile });
  }

  leaveSeat(): Promise<FibActionResult> {
    return this.#post('/fib/leave', { roomCode: this.#roomCodeOrThrow() });
  }

  kick(targetSeat: number): Promise<FibActionResult> {
    return this.#post('/fib/kick', { roomCode: this.#roomCodeOrThrow(), targetSeat });
  }

  clearSeats(): Promise<FibActionResult> {
    return this.#post('/fib/clear-seats', { roomCode: this.#roomCodeOrThrow() });
  }

  updateConfig(numberOfPlayers: number): Promise<FibActionResult> {
    return this.#post('/fib/update-config', {
      roomCode: this.#roomCodeOrThrow(),
      numberOfPlayers,
    });
  }

  startRound(): Promise<FibActionResult> {
    return this.#post('/fib/start-round', { roomCode: this.#roomCodeOrThrow() });
  }

  nextRound(): Promise<FibActionResult> {
    return this.#post('/fib/next-round', { roomCode: this.#roomCodeOrThrow() });
  }

  reveal(): Promise<FibActionResult> {
    return this.#post('/fib/reveal', { roomCode: this.#roomCodeOrThrow() });
  }

  restart(): Promise<FibActionResult> {
    return this.#post('/fib/restart', { roomCode: this.#roomCodeOrThrow() });
  }
}
