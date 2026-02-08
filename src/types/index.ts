/**
 * Shared type definitions - cross-layer types
 *
 * Types here are used across multiple layers (models/services/screens/hooks).
 * Layer-specific types stay in their own directory.
 */

export type {
  RoleRevealAnimation,
  ResolvedRoleRevealAnimation,
  RandomizableAnimation,
} from './RoleRevealAnimation';
export { RANDOMIZABLE_ANIMATIONS, resolveRandomAnimation, simpleHash } from './RoleRevealAnimation';

export type { LocalGameState, LocalPlayer, GameStateListener } from './GameStateTypes';
export { GameStatus } from './GameStateTypes';
