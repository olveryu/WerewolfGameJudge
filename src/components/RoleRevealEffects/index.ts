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
 *       effectType="flip" // 'roulette' | 'flip' | 'scratch' | 'tarot' | 'fire'
 *       role={role}
 *       onComplete={() => setShowReveal(false)}
 *       enableSound={true}
 *       enableHaptics={true}
 *     />
 *   );
 * }
 * ```
 */

// Main animator component
export { RoleRevealAnimator, createRoleData } from './RoleRevealAnimator';

// Individual effect components (for advanced usage)
export { EnhancedRoulette, type EnhancedRouletteProps } from './EnhancedRoulette';
export { FlipReveal } from './FlipReveal';
export { ScratchReveal } from './ScratchReveal';
export { TarotDraw } from './TarotDraw';
export { FireReveal } from './FireReveal';

// Types
export type {
  RoleData,
  RoleAlignment,
  RevealEffectType,
  RoleRevealEffectProps,
  RoleRevealAnimatorProps,
  AlignmentTheme,
} from './types';

export { ALIGNMENT_THEMES } from './types';

// Configuration (for customization)
export { CONFIG } from './config';

// Utilities (for advanced usage)
export { playSound, createTickPlayer, cleanupSounds, type SoundType } from './utils/sound';

export { triggerHaptic, triggerHapticSequence, type HapticStyle } from './utils/haptics';

export {
  canUseNativeDriver,
  canUseHaptics,
  canUseAudio,
  isWeb,
  isIOS,
  isAndroid,
  getReducedMotionPreference,
  getOptimalParticleCount,
} from './utils/platform';

// Common components (for building custom effects)
export { Particle, generateBurstParticles, type ParticleProps } from './common/Particle';
export { ParticleBurst, type ParticleBurstProps } from './common/ParticleBurst';
export { GradientOverlay, type GradientOverlayProps } from './common/GradientOverlay';
export { GlowBorder, type GlowBorderProps } from './common/GlowBorder';
export { ShineEffect, type ShineEffectProps } from './common/ShineEffect';
export { RoleCard, type RoleCardProps } from './common/RoleCard';
