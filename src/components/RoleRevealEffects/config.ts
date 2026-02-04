/**
 * RoleRevealEffects - Configuration
 *
 * Centralized animation parameters for easy tuning.
 */

export const CONFIG = {
  // =====================================================
  // Common settings
  // =====================================================
  common: {
    /** Default animation duration in ms */
    defaultDuration: 300,
    /** Fade-in duration for reduced motion mode */
    reducedMotionFadeDuration: 500,
    /** Minimum scale for reduced motion */
    reducedMotionMinScale: 0.95,
  },

  // =====================================================
  // Enhanced Roulette
  // =====================================================
  roulette: {
    /** Height of each item in the roulette */
    itemHeight: 80,
    /** Number of visible items in the window */
    visibleItems: 3,
    /** Number of full rotations before stopping */
    spinRotations: 5,
    /** Total spin duration in ms */
    spinDuration: 4000,
    /** Tick sound interval during fast spin (ms) */
    tickIntervalFast: 80,
    /** Tick sound interval during slow spin (ms) */
    tickIntervalSlow: 200,
    /** Golden border flash count */
    highlightFlashCount: 3,
    /** Flash duration per cycle (ms) */
    highlightFlashDuration: 200,
    /** Hold duration after reveal before calling onComplete (ms) */
    revealHoldDuration: 1500,
    /** Particle count for flow effect */
    particleCount: 12,
    /** Particle trail length */
    particleTrailLength: 3,
  },

  // =====================================================
  // Flip Reveal
  // =====================================================
  flip: {
    /** Flip animation duration */
    flipDuration: 600,
    /** Card dimensions */
    cardWidth: 220,
    cardHeight: 320,
    /** Shadow animation range */
    shadowOpacityRange: [0.2, 0.5] as [number, number],
    shadowBlurRange: [10, 25] as [number, number],
    /** Shine sweep duration */
    shineDuration: 400,
    /** Shine sweep delay after flip */
    shineDelay: 100,
    /** Particle burst count */
    particleCount: 20,
    /** Particle spread radius */
    particleSpreadRadius: 150,
    /** Particle animation duration */
    particleDuration: 800,
    /** Hold duration after reveal before calling onComplete (ms) */
    revealHoldDuration: 1500,
  },

  // =====================================================
  // Scratch Reveal
  // =====================================================
  scratch: {
    /** Scratch brush radius */
    brushRadius: 15,
    /** Auto-reveal threshold (percentage scratched) */
    autoRevealThreshold: 0.5,
    /** Scratch overlay color */
    overlayColor: '#374151',
    /** Scratch pattern colors */
    patternColors: ['#4B5563', '#6B7280', '#9CA3AF'],
    /** Reveal animation duration after threshold */
    revealDuration: 500,
    /** Grid size for scratch detection - smaller = finer scratch effect */
    gridSize: 3,
    /** Hold duration after reveal before calling onComplete (ms) */
    revealHoldDuration: 1500,
  },

  // =====================================================
  // Fragment Assemble
  // =====================================================
  fragment: {
    /** Grid dimensions (rows x cols) - more fragments = finer detail */
    gridRows: 8,
    gridCols: 4,
    /** Fragment assembly duration */
    assembleDuration: 3000,
    /** Stagger delay between fragments */
    staggerDelay: 50,
    /** Max initial distance from center */
    initialDistanceRange: [200, 400] as [number, number],
    /** Initial rotation range (degrees) */
    initialRotationRange: [-180, 180] as [number, number],
    /** Initial scale range */
    initialScaleRange: [0.3, 0.7] as [number, number],
    /** Flash duration after assembly */
    flashDuration: 300,
    /** Low-end device threshold (reduce fragments) */
    lowEndFragmentCount: 9, // 3x3
    /** Hold duration after reveal before calling onComplete (ms) */
    revealHoldDuration: 1500,
  },

  // =====================================================
  // Fog Reveal
  // =====================================================
  fog: {
    /** Number of fog layers */
    layerCount: 4,
    /** Fog disperse duration */
    disperseDuration: 3000,
    /** Stagger delay between layers */
    layerStaggerDelay: 100,
    /** Fog opacity range */
    opacityRange: [0.7, 0.9] as [number, number],
    /** Fog scale expansion */
    scaleExpansion: 1.5,
    /** Fog translation distance */
    translateDistance: 200,
    /** Base blur amount (simulated with opacity) */
    blurSimulation: 0.6,
    /** Hold duration after reveal before calling onComplete (ms) */
    revealHoldDuration: 1500,
  },

  // =====================================================
  // Sound effects
  // =====================================================
  sound: {
    /** Tick sound volume (0-1) */
    tickVolume: 0.3,
    /** Confirm sound volume */
    confirmVolume: 0.5,
    /** Whoosh sound volume */
    whooshVolume: 0.4,
    /** Sound fade duration */
    fadeDuration: 100,
  },

  // =====================================================
  // Haptics
  // =====================================================
  haptics: {
    /** Use light impact for ticks */
    tickStyle: 'light' as const,
    /** Use medium impact for reveals */
    revealStyle: 'medium' as const,
    /** Use heavy impact for dramatic moments */
    dramaticStyle: 'heavy' as const,
  },
} as const;

export type Config = typeof CONFIG;
