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
 *   const role = createRoleData('wolf', '狼人', 'wolf', '🐺', '每晚与狼队友共同选择一名玩家袭击');
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
export { RoleRevealAnimator } from './RoleRevealAnimator';
export { createRoleData } from './RoleRevealAnimator';

// Individual effect components (for advanced usage)
export { ScratchReveal } from './ScratchReveal';

// Types
export type { RevealEffectType, RoleData } from './types';
