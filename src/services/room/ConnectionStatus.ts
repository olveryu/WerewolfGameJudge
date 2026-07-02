/**
 * ConnectionStatus — UI-facing room connection state.
 *
 * Shared by all room modes. Individual facades map their transport FSM into this enum.
 */

/** Connection status for room UI display. */
export enum ConnectionStatus {
  Connecting = 'Connecting',
  Syncing = 'Syncing',
  Live = 'Live',
  Disconnected = 'Disconnected',
  Failed = 'Failed',
}
