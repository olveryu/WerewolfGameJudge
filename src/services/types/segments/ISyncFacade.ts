/**
 * ISyncFacade — State sync, reconnection, and connection status
 *
 * Covers DB state fetch, audio resume after rejoin, connection status
 * subscription, and dead-channel recovery. Does not include room lifecycle,
 * seating, game control, or player actions.
 */

import type { ConnectionStatus, ReconnectTrigger } from '../IGameFacade';

export interface ISyncFacade {
  fetchStateFromDB(): Promise<boolean>;
  readonly wasAudioInterrupted: boolean;
  resumeAfterRejoin(): Promise<void>;
  addConnectionStatusListener(fn: (status: ConnectionStatus) => void): () => void;
  reconnectChannel(trigger?: ReconnectTrigger): Promise<void>;
}
