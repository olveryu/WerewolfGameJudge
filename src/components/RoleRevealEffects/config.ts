/**
 * RoleRevealEffects/config - 揭示动画集中配置
 *
 * 所有动画参数（时长、尺寸、数量）统一在此调整。
 * 导出声明式动画参数常量。不 import service，不含运行时副作用。
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
  // Role Hunt (角色猎场)
  // =====================================================
  roleHunt: {
    /** Delay after hitting target before revealing card (ms) */
    hitRevealDelay: 500,
    /** Auto-select timeout if user doesn't find the target (ms) */
    autoSelectTimeout: 8000,
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
  // Card Pick (抽牌)
  // =====================================================
  cardPick: {
    /** Duration for cards to spread onto the table (ms) */
    spreadDuration: 600,
    /** Stagger delay between each card appearing (ms) */
    spreadStagger: 60,
    /** Duration for selected card to fly to center (ms) */
    flyToCenterDuration: 500,
    /** Duration for remaining cards to fade out (ms) */
    fadeOutDuration: 300,
    /** Card flip duration (ms) */
    flipDuration: 800,
    /** Mini card width ratio relative to screen width */
    miniCardWidthRatio: 0.18,
    /** Mini card aspect ratio */
    miniCardAspectRatio: 1.4,
    /** Max columns in the grid */
    maxColumns: 4,
    /** Gap between cards (px) */
    cardGap: 10,
    /** Auto-select timeout if user doesn't tap (ms) */
    autoSelectTimeout: 5000,
    /** Duration for a card to fade out when removed by another player (ms) */
    cardRemoveExitDuration: 400,
    /** Hold duration after reveal before calling onComplete (ms) */
    revealHoldDuration: 0,
  },

  // =====================================================
  // Alignment reveal effects (阵营特效)
  // =====================================================
  alignmentEffects: {
    /** Delay before effects start after card reveal (ms) */
    effectStartDelay: 100,

    // ── God (神职) — 圣光系 ──
    /** Number of radiating light rays */
    godRayCount: 12,
    /** Max ray length (px) */
    godRayLength: 180,
    /** Ray + cross + halo total animation duration (ms) */
    godAnimationDuration: 2000,
    /** Number of sparkle particles (matches HTML demo: 40 canvas particles) */
    godParticleCount: 40,

    // ── Wolf (狼人) — 暗红系 ──
    /** Wolf total animation duration (ms) */
    wolfAnimationDuration: 2000,
    /** Number of shockwave rings */
    wolfWaveCount: 3,
    /** Number of spark fragments (matches HTML demo: 24 sparks) */
    wolfSparkCount: 24,

    // ── Third (第三方) — 神秘系 ──
    /** Outer rune ring rotation cycle (ms) */
    thirdRuneRotationDuration: 12000,
    /** Number of rune symbols */
    thirdRuneSymbolCount: 6,
    /** Inner rune ring rotation cycle — HTML: 8s reverse (ms) */
    thirdInnerRingDuration: 8000,
    /** Spiral particle orbit cycle (ms) */
    thirdOrbitDuration: 6000,
    /** Number of spiral particles (matches HTML demo: 30 canvas particles) */
    thirdParticleCount: 30,

    // ── Villager (村民) — 宁静系 ──
    /** Number of floating firefly particles */
    villagerFireflyCount: 16,
    /** Firefly upward drift cycle (ms) */
    villagerFireflyDuration: 5000,
    /** Number of twinkling star points */
    villagerStarCount: 10,
    /** Star twinkle cycle (ms) */
    villagerTwinkleDuration: 3000,

    // ── Shared ──
    /** How long alignment effects display before triggering onComplete (ms) */
    effectDisplayDuration: 2500,
    /** Breathing border cycle duration — per alignment (ms, matches HTML demo) */
    breathingDuration: {
      wolf: 2500,
      god: 3000,
      third: 4000,
      villager: 2500,
    } as Record<string, number>,

    // ── Screen flash ──
    /** Screen flash duration (ms) */
    screenFlashDuration: 600,
    /** Screen flash peak opacity per alignment */
    screenFlashOpacity: {
      wolf: 0.45,
      god: 0.5,
      third: 0.4,
      villager: 0.3,
    } as Record<string, number>,

    // ── Card content entrance animations ──
    /** Emoji pop animation delay after reveal (ms) */
    emojiPopDelay: 350,
    /** Emoji pop animation duration (ms) */
    emojiPopDuration: 600,
    /** Role name slide-up delay after reveal (ms) */
    nameSlideDelay: 500,
    /** Role name slide-up duration (ms) */
    nameSlideDuration: 500,
    /** Description slide-up delay after reveal (ms) */
    descSlideDelay: 600,
    /** Description slide-up duration (ms) */
    descSlideDuration: 500,

    // ── Wolf shake ──
    /** Wolf card shake delay after reveal (ms) */
    wolfShakeDelay: 350,
    /** Wolf card shake duration (ms) */
    wolfShakeDuration: 500,
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
