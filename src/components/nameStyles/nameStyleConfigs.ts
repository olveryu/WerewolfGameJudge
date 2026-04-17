/**
 * nameStyleConfigs — 20 名字特效的声明式配置
 *
 * 每个配置描述颜色、文字阴影、渐变（web-only）、动画参数。
 * 渲染器根据平台选择实现方式：
 * - Web: CSS background-clip: text + @keyframes
 * - Native: 纯色 + textShadow（渐变/动画降级）
 */

import type { NameStyleId } from '@werewolf/game-engine/growth/rewardCatalog';

// ── Types ───────────────────────────────────────────────────────────────────

export type NameStyleTier = 'rare' | 'epic' | 'legendary';

export interface TextShadowLayer {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

/** Web-only gradient config (background-clip: text) */
export interface GradientConfig {
  /** CSS linear-gradient stops, e.g. '#FF4500 0%, #FFD700 25%' */
  stops: string;
  /** background-size for animation, e.g. '300% 100%' */
  backgroundSize?: string;
  /** CSS drop-shadow filter value */
  dropShadow?: string;
}

/** Animation keyframes for web */
export interface AnimationConfig {
  /** CSS @keyframes name (must be unique) */
  name: string;
  /** Duration string, e.g. '2.4s' */
  duration: string;
  /** CSS timing function */
  timing: string;
  /** Full @keyframes body (CSS rule content) */
  keyframes: string;
}

export interface NameStyleConfig {
  /** Engine ID (matches rewardCatalog) */
  id: NameStyleId;
  /** 中文显示名 */
  name: string;
  /** Rarity tier for UI grouping */
  tier: NameStyleTier;
  /** Primary text color (used on native, web fallback for non-gradient) */
  color: string;
  /** Multi-layer text shadows (native + web non-animated) */
  textShadows?: TextShadowLayer[];
  /** Web-only gradient text (background-clip: text) */
  gradient?: GradientConfig;
  /** CSS animations (web-only, epic/legendary) */
  animations?: AnimationConfig[];
}

// ── Configs ─────────────────────────────────────────────────────────────────

export const NAME_STYLE_CONFIGS: Record<NameStyleId, NameStyleConfig> = {
  // ══════════════════════════════════════════════════════════════════════════
  // RARE (10) — static glow / gradient text / material feel
  // ══════════════════════════════════════════════════════════════════════════

  silverGleam: {
    id: 'silverGleam',
    name: '银光',
    tier: 'rare',
    color: '#6B7D8D',
    textShadows: [
      { offsetX: 0, offsetY: 0, blur: 4, color: 'rgba(170,200,230,0.7)' },
      { offsetX: 0, offsetY: 0, blur: 8, color: 'rgba(150,180,210,0.4)' },
      { offsetX: 0, offsetY: 1, blur: 0, color: 'rgba(220,235,255,0.6)' },
    ],
  },

  copperEmber: {
    id: 'copperEmber',
    name: '赤铜余烬',
    tier: 'rare',
    color: '#C87533',
    textShadows: [
      { offsetX: 0, offsetY: 0, blur: 4, color: 'rgba(255,140,60,0.5)' },
      { offsetX: 0, offsetY: 0, blur: 8, color: 'rgba(200,117,51,0.3)' },
      { offsetX: 0, offsetY: 1, blur: 0, color: 'rgba(255,200,140,0.4)' },
    ],
  },

  bloodMoonGlow: {
    id: 'bloodMoonGlow',
    name: '血月',
    tier: 'rare',
    color: '#D42C2C',
    textShadows: [
      { offsetX: 0, offsetY: 0, blur: 5, color: 'rgba(212,44,44,0.6)' },
      { offsetX: 0, offsetY: 0, blur: 10, color: 'rgba(180,30,30,0.3)' },
      { offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(255,100,100,0.4)' },
    ],
  },

  jadeShimmer: {
    id: 'jadeShimmer',
    name: '翡翠微光',
    tier: 'rare',
    color: '#2D9B5A',
    textShadows: [
      { offsetX: 0, offsetY: 0, blur: 4, color: 'rgba(45,155,90,0.5)' },
      { offsetX: 0, offsetY: 0, blur: 8, color: 'rgba(60,179,113,0.3)' },
      { offsetX: 0, offsetY: 1, blur: 0, color: 'rgba(144,238,170,0.35)' },
    ],
  },

  amethystGlow: {
    id: 'amethystGlow',
    name: '紫晶',
    tier: 'rare',
    color: '#8B4FC8',
    textShadows: [
      { offsetX: 0, offsetY: 0, blur: 5, color: 'rgba(139,79,200,0.55)' },
      { offsetX: 0, offsetY: 0, blur: 10, color: 'rgba(159,122,234,0.3)' },
      { offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(200,170,255,0.4)' },
    ],
  },

  indigoRadiance: {
    id: 'indigoRadiance',
    name: '靛蓝辉',
    tier: 'rare',
    color: '#5A50F0',
    textShadows: [
      { offsetX: 0, offsetY: 0, blur: 5, color: 'rgba(90,80,240,0.55)' },
      { offsetX: 0, offsetY: 0, blur: 10, color: 'rgba(129,140,248,0.35)' },
      { offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(180,185,255,0.4)' },
    ],
  },

  twilightGradient: {
    id: 'twilightGradient',
    name: '暮光渐变',
    tier: 'rare',
    color: '#9B59B6', // native fallback (gradient midpoint)
    gradient: {
      stops: '#4F46E5 0%, #9B59B6 50%, #E74C3C 100%',
      dropShadow: 'drop-shadow(0 0 2px rgba(79,70,229,0.35))',
    },
  },

  roseGold: {
    id: 'roseGold',
    name: '玫瑰金',
    tier: 'rare',
    color: '#B8863A', // native fallback
    gradient: {
      stops: '#C47090 0%, #B8863A 50%, #C47090 100%',
      dropShadow: 'drop-shadow(0 0 2px rgba(184,134,58,0.45))',
    },
  },

  frostVeil: {
    id: 'frostVeil',
    name: '霜纱',
    tier: 'rare',
    color: '#3A8FA8',
    textShadows: [
      { offsetX: 0, offsetY: 0, blur: 5, color: 'rgba(80,180,215,0.65)' },
      { offsetX: 0, offsetY: 0, blur: 10, color: 'rgba(120,200,230,0.35)' },
      { offsetX: 0, offsetY: -1, blur: 0, color: 'rgba(200,240,255,0.5)' },
    ],
  },

  amberFlare: {
    id: 'amberFlare',
    name: '琥珀烈焰',
    tier: 'rare',
    color: '#D4960A',
    textShadows: [
      { offsetX: 0, offsetY: 0, blur: 4, color: 'rgba(212,150,10,0.6)' },
      { offsetX: 0, offsetY: 0, blur: 8, color: 'rgba(255,165,0,0.3)' },
      { offsetX: 0, offsetY: 1, blur: 0, color: 'rgba(255,220,120,0.4)' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // EPIC (6) — gradient + single-property looping animation
  // ══════════════════════════════════════════════════════════════════════════

  moltenGoldPulse: {
    id: 'moltenGoldPulse',
    name: '熔金脉动',
    tier: 'epic',
    color: '#D4A017',
    textShadows: [
      { offsetX: 0, offsetY: 0, blur: 5, color: 'rgba(255,215,0,0.6)' },
      { offsetX: 0, offsetY: 0, blur: 10, color: 'rgba(255,165,0,0.35)' },
      { offsetX: 0, offsetY: 0, blur: 15, color: 'rgba(255,140,0,0.15)' },
    ],
    animations: [
      {
        name: 'moltenGoldPulse',
        duration: '2.4s',
        timing: 'ease-in-out',
        keyframes: `0%, 100% { text-shadow: 0 0 5px rgba(255,215,0,0.6), 0 0 10px rgba(255,165,0,0.35), 0 0 15px rgba(255,140,0,0.15); }
    50% { text-shadow: 0 0 8px rgba(255,215,0,0.9), 0 0 16px rgba(255,165,0,0.55), 0 0 22px rgba(255,140,0,0.3); }`,
      },
    ],
  },

  frostBreath: {
    id: 'frostBreath',
    name: '冰霜呼吸',
    tier: 'epic',
    color: '#2E8EB5', // native fallback
    gradient: {
      stops: '#2E8EB5 0%, #5BC0EB 50%, #8AD8F5 100%',
      dropShadow: 'drop-shadow(0 0 4px rgba(46,142,181,0.55))',
    },
    animations: [
      {
        name: 'frostBreath',
        duration: '3s',
        timing: 'ease-in-out',
        keyframes: `0%, 100% { filter: drop-shadow(0 0 4px rgba(91,192,235,0.55)); }
    50% { filter: drop-shadow(0 0 8px rgba(91,192,235,0.85)) drop-shadow(0 0 3px rgba(200,240,255,0.5)); }`,
      },
    ],
  },

  venomShift: {
    id: 'venomShift',
    name: '剧毒流光',
    tier: 'epic',
    color: '#1A9A4A', // native fallback
    gradient: {
      stops: '#1A9A4A, #6BCB77, #D4A017, #1A9A4A',
      backgroundSize: '300% 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(26,154,74,0.4))',
    },
    animations: [
      {
        name: 'venomShift',
        duration: '4s',
        timing: 'ease-in-out',
        keyframes: `0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }`,
      },
    ],
  },

  shadowPulse: {
    id: 'shadowPulse',
    name: '暗影脉冲',
    tier: 'epic',
    color: '#3D3D55',
    textShadows: [
      { offsetX: 0, offsetY: 0, blur: 4, color: 'rgba(61,61,85,0.5)' },
      { offsetX: 0, offsetY: 0, blur: 8, color: 'rgba(55,48,163,0.25)' },
    ],
    animations: [
      {
        name: 'shadowPulse',
        duration: '2.8s',
        timing: 'ease-in-out',
        keyframes: `0%, 100% {
      color: #3D3D55;
      text-shadow: 0 0 4px rgba(61,61,85,0.5), 0 0 8px rgba(55,48,163,0.25);
    }
    50% {
      color: #6360E8;
      text-shadow: 0 0 7px rgba(99,96,232,0.75), 0 0 14px rgba(129,140,248,0.4);
    }`,
      },
    ],
  },

  crimsonTide: {
    id: 'crimsonTide',
    name: '赤潮',
    tier: 'epic',
    color: '#C82828', // native fallback
    gradient: {
      stops: '#C82828, #FF6347, #FF8C42, #C82828',
      backgroundSize: '300% 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(200,40,40,0.4))',
    },
    animations: [
      {
        name: 'crimsonTide',
        duration: '3.5s',
        timing: 'ease-in-out',
        keyframes: `0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }`,
      },
    ],
  },

  stormElectric: {
    id: 'stormElectric',
    name: '雷暴',
    tier: 'epic',
    color: '#4FC3F7',
    textShadows: [
      { offsetX: 0, offsetY: 0, blur: 5, color: 'rgba(79,195,247,0.6)' },
      { offsetX: 0, offsetY: 0, blur: 10, color: 'rgba(100,200,255,0.3)' },
    ],
    animations: [
      {
        name: 'stormElectric',
        duration: '2s',
        timing: 'ease-in-out',
        keyframes: `0%, 100% {
      color: #4FC3F7;
      text-shadow: 0 0 5px rgba(79,195,247,0.6), 0 0 10px rgba(100,200,255,0.3);
    }
    40% {
      color: #E0F7FF;
      text-shadow: 0 0 8px rgba(200,240,255,0.9), 0 0 16px rgba(79,195,247,0.6), 0 0 2px rgba(255,255,255,0.7);
    }
    55% {
      color: #4FC3F7;
      text-shadow: 0 0 5px rgba(79,195,247,0.6), 0 0 10px rgba(100,200,255,0.3);
    }`,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LEGENDARY (4) — multi-animation layered effects
  // ══════════════════════════════════════════════════════════════════════════

  phoenixRebirth: {
    id: 'phoenixRebirth',
    name: '凤凰涅槃',
    tier: 'legendary',
    color: '#FF4500', // native fallback
    gradient: {
      stops: '#FF4500 0%, #FFD700 25%, #FF6347 50%, #FFAA00 75%, #FF4500 100%',
      backgroundSize: '200% 100%',
      dropShadow: 'drop-shadow(0 0 5px rgba(255,69,0,0.55))',
    },
    animations: [
      {
        name: 'phoenixShift',
        duration: '3s',
        timing: 'ease-in-out',
        keyframes: `0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }`,
      },
      {
        name: 'phoenixGlow',
        duration: '2s',
        timing: 'ease-in-out',
        keyframes: `0%, 100% { filter: drop-shadow(0 0 5px rgba(255,69,0,0.55)); }
    50% { filter: drop-shadow(0 0 10px rgba(255,215,0,0.85)) drop-shadow(0 0 3px rgba(255,100,0,0.5)); }`,
      },
    ],
  },

  voidStar: {
    id: 'voidStar',
    name: '星渊',
    tier: 'legendary',
    color: '#4F46E5', // native fallback
    gradient: {
      stops: '#0D0D2B 0%, #4F46E5 20%, #818CF8 40%, #C084FC 60%, #4F46E5 80%, #0D0D2B 100%',
      backgroundSize: '300% 100%',
      dropShadow: 'drop-shadow(0 0 4px rgba(129,140,248,0.6))',
    },
    animations: [
      {
        name: 'voidStarShift',
        duration: '4s',
        timing: 'ease-in-out',
        keyframes: `0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }`,
      },
      {
        name: 'voidStarGlow',
        duration: '2.5s',
        timing: 'ease-in-out',
        keyframes: `0%, 100% { filter: drop-shadow(0 0 4px rgba(129,140,248,0.6)); }
    50% { filter: drop-shadow(0 0 10px rgba(79,70,229,0.9)) drop-shadow(0 0 4px rgba(192,132,252,0.5)); }`,
      },
    ],
  },

  dragonBreath: {
    id: 'dragonBreath',
    name: '龙息',
    tier: 'legendary',
    color: '#FF4500', // native fallback
    gradient: {
      stops: '#8B0000 0%, #FF4500 20%, #FFD700 45%, #FF4500 70%, #8B0000 100%',
      backgroundSize: '250% 100%',
      dropShadow: 'drop-shadow(0 0 5px rgba(255,69,0,0.6))',
    },
    animations: [
      {
        name: 'dragonShift',
        duration: '3.5s',
        timing: 'ease-in-out',
        keyframes: `0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }`,
      },
      {
        name: 'dragonGlow',
        duration: '2.2s',
        timing: 'ease-in-out',
        keyframes: `0%, 100% { filter: drop-shadow(0 0 5px rgba(255,69,0,0.6)); }
    50% { filter: drop-shadow(0 0 10px rgba(255,215,0,0.9)) drop-shadow(0 0 5px rgba(139,0,0,0.5)); }`,
      },
    ],
  },

  celestialDawn: {
    id: 'celestialDawn',
    name: '天际曙光',
    tier: 'legendary',
    color: '#C87DA8', // native fallback (gradient midpoint)
    gradient: {
      stops:
        '#3730A3 0%, #6366C8 15%, #C87DA8 35%, #D49A10 55%, #C87DA8 75%, #6366C8 90%, #3730A3 100%',
      backgroundSize: '300% 100%',
      dropShadow: 'drop-shadow(0 0 4px rgba(249,168,212,0.5))',
    },
    animations: [
      {
        name: 'celestialShift',
        duration: '5s',
        timing: 'ease-in-out',
        keyframes: `0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }`,
      },
      {
        name: 'celestialGlow',
        duration: '3s',
        timing: 'ease-in-out',
        keyframes: `0%, 100% { filter: drop-shadow(0 0 4px rgba(249,168,212,0.5)); }
    50% { filter: drop-shadow(0 0 8px rgba(251,191,36,0.75)) drop-shadow(0 0 4px rgba(129,140,248,0.5)); }`,
      },
    ],
  },
};
