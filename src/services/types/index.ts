/**
 * Types index - Broadcast type exports
 * 
 * Re-exports public and private broadcast types for easier imports.
 */

// Public broadcast types (whitelist)
export type {
  PublicPayload,
  PublicStateUpdate,
  PublicRoleTurn,
  PublicNightEnd,
  PublicPlayerJoined,
  PublicPlayerLeft,
  PublicGameRestarted,
  PublicSeatActionAck,
  PublicSeatRejected,
  PublicSnapshotResponse,
  PublicGameState,
  PublicPlayer,
} from './PublicBroadcast';

// Private broadcast types (sensitive)
export type {
  PrivateMessage,
  PrivatePayload,
  WitchContextPayload,
  SeerRevealPayload,
  PsychicRevealPayload,
  BlockedPayload,
  InboxKey,
} from './PrivateBroadcast';

export { makeInboxKey } from './PrivateBroadcast';
