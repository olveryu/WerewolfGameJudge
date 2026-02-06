/**
 * policy/index.ts - Public exports for RoomInteractionPolicy
 */

export * from './types';
export { getInteractionResult } from './RoomInteractionPolicy';
export { getActorIdentity, isActorIdentityValid } from './actorIdentity';
export type { ActorIdentityInput, ActorIdentity } from './actorIdentity';
