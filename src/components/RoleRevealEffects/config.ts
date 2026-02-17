/**
 * RoleRevealEffects/config - 揭示动画集中配置
 *
 * 所有动画参数（时长、尺寸、数量）统一在此调整。
 *
 * ✅ 允许：声明式动画参数常量
 * ❌ 禁止：import service / 运行时副作用
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

    // ── Unified card dimensions ──
    /** Max card width (px) */
    cardMaxWidth: 320,
    /** Card width as fraction of screen width */
    cardWidthRatio: 0.82,
    /** Card height = cardWidth * aspectRatio */
    cardAspectRatio: 1.5,

    // ── Unified GlowBorder params ──
    /** GlowBorder flash count */
    glowFlashCount: 1,
    /** GlowBorder flash duration per cycle (ms) */
    glowFlashDuration: 100,
    /** GlowBorder border width */
    glowBorderWidth: 3,
    /** GlowBorder size padding (added to each side of card) */
    glowPadding: 8,
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
    spinDuration: 2500,
    /** Tick sound interval during fast spin (ms) */
    tickIntervalFast: 80,
    /** Tick sound interval during slow spin (ms) */
    tickIntervalSlow: 200,

    /** Hold duration after reveal before calling onComplete (ms) */
    revealHoldDuration: 0,
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
    revealHoldDuration: 0,
  },

  // =====================================================
  // Scratch Reveal
  // =====================================================
  scratch: {
    /** Scratch brush radius */
    brushRadius: 28,
    /** Auto-reveal threshold (percentage scratched) - 10% required */
    autoRevealThreshold: 0.1,
    /** Scratch overlay color */
    overlayColor: '#374151',
    /** Scratch pattern colors */
    patternColors: ['#4B5563', '#6B7280', '#9CA3AF'],
    /** Reveal animation duration after threshold */
    revealDuration: 500,
    /** Grid size for scratch detection - smaller = finer scratch effect */
    gridSize: 3,
    /** Hold duration after reveal before calling onComplete (ms) */
    revealHoldDuration: 0,
  },

  // =====================================================
  // Tarot Draw
  // =====================================================
  tarot: {
    /** Duration for shuffle animation before drawing (ms) */
    shuffleDuration: 2000,
    /** Duration for card to float up from deck (ms) */
    floatUpDuration: 800,
    /** Duration for card to hover before flip (ms) */
    hoverDuration: 600,
    /** Card flip duration (ms) */
    flipDuration: 800,
    /** Aura pulse duration (ms) */
    auraPulseDuration: 400,
    /** Hold duration after reveal before calling onComplete (ms) */
    revealHoldDuration: 0,
  },

  // =====================================================
  // Gacha Machine (扭蛋机)
  // =====================================================
  gachaMachine: {
    /** Dial rotation speed (ms per turn) */
    dialRotateDuration: 400,
    /** Number of dial rotations */
    dialRotations: 3,
    /** Capsule drop duration (ms) */
    capsuleDropDuration: 600,
    /** Capsule bounce height */
    capsuleBounceHeight: 30,
    /** Capsule open duration (ms) */
    capsuleOpenDuration: 500,
    /** Hold duration after reveal before calling onComplete (ms) */
    revealHoldDuration: 0,
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
