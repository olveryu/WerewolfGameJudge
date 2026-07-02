/**
 * IFibFacade — public client boundary for FibKing screens.
 *
 * Screens depend on this interface; the concrete FibFacade wires store,
 * transport, and HTTP actions at the composition root.
 */

import type { FibConfig, FibState } from '@werewolf/game-engine/fibking/types';
import type { RosterEntry } from '@werewolf/game-engine/protocol/common';

import type { ConnectionStatus } from '@/services/room/ConnectionStatus';
import type { RoomActionResult } from '@/services/room/defineRoomAction';

export type FibActionResult = RoomActionResult;

export interface IFibFacade {
  getState(): FibState | null;
  getRevision(): number;
  subscribe(onChange: () => void): () => void;
  getMyUserId(): string | null;
  isHost(): boolean;
  addConnectionStatusListener(fn: (status: ConnectionStatus) => void): () => void;
  manualReconnect(): void;
  createRoom(config: FibConfig, hostUserId: string, initialRoomNumber?: string): Promise<string>;
  connect(roomCode: string, userId: string): Promise<void>;
  leave(): Promise<void>;
  sit(seat: number, profile: RosterEntry): Promise<FibActionResult>;
  leaveSeat(): Promise<FibActionResult>;
  kick(targetSeat: number): Promise<FibActionResult>;
  clearSeats(): Promise<FibActionResult>;
  fillBots(): Promise<FibActionResult>;
  updateConfig(numberOfPlayers: number): Promise<FibActionResult>;
  startRound(): Promise<FibActionResult>;
  nextRound(): Promise<FibActionResult>;
  reveal(): Promise<FibActionResult>;
  restart(): Promise<FibActionResult>;
}
