/**
 * RoleRevealEffects - Main entry point
 *
 * Unified API for all role reveal animation effects.
 *
 * @example
 * ```tsx
 * import { RoleRevealAnimator, createRoleData } from '@/components/RoleRevealEffects';
 *
 * function MyScreen() {
 *   const [showReveal, setShowReveal] = useState(false);
 *   const role = createRoleData('wolf', '狼人', 'wolf', '🐺', '每晚与狼队友共同选择一名玩家猎杀');
 *
 *   return (
 *     <RoleRevealAnimator
 *       visible={showReveal}
 *       effectType="roleHunt" // 'roulette' | 'roleHunt' | 'scratch' | 'tarot' | 'gachaMachine' | 'cardPick'
 *       role={role}
 *       onComplete={() => setShowReveal(false)}
 *       enableHaptics={true}
 *     />
 *   );
 * }
 * ```
 */

// Main animator component
export { createRoleData, RoleRevealAnimator } from './RoleRevealAnimator';

// Individual effect components (for advanced usage)
export { RoleHunt } from './RoleHunt/RoleHunt';
export { ScratchReveal } from './ScratchReveal';

// Types
export type { RevealEffectType, RoleData } from './types';
