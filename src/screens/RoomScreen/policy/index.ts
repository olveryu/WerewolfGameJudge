/**
 * policy/index.ts - Public exports for RoomInteractionPolicy
 */

export type { ActorIdentity,ActorIdentityInput } from './actorIdentity';
export { getActorIdentity, isActorIdentityValid } from './actorIdentity';
export { getInteractionResult } from './RoomInteractionPolicy';
export * from './types';
