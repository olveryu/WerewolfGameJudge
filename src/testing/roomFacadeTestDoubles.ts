/**
 * roomFacadeTestDoubles — typed facade doubles for React context tests.
 */

import type { IFibFacade } from '@/services/games/fibking/IFibFacade';
import { ConnectionStatus } from '@/services/room/ConnectionStatus';

const ok = { success: true } as const;

export function createFibFacadeTestDouble(overrides: Partial<IFibFacade> = {}): IFibFacade {
  const facade: IFibFacade = {
    getState: () => null,
    getRevision: () => 0,
    subscribe: () => () => {},
    getMyUserId: () => null,
    isHost: () => false,
    addConnectionStatusListener: (fn) => {
      fn(ConnectionStatus.Disconnected);
      return () => {};
    },
    manualReconnect: () => {},
    createRoom: async () => '0000',
    connect: async () => {},
    leave: async () => {},
    sit: async () => ok,
    leaveSeat: async () => ok,
    kick: async () => ok,
    clearSeats: async () => ok,
    fillBots: async () => ok,
    updateConfig: async () => ok,
    startRound: async () => ok,
    nextRound: async () => ok,
    reveal: async () => ok,
    restart: async () => ok,
  };

  return { ...facade, ...overrides };
}
