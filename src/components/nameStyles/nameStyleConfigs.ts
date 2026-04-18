/**
 * nameStyleConfigs — 20 名字特效的声明式配置
 *
 * 每个配置描述颜色、文字阴影、渐变（web-only）、动画参数。
 * 渲染器根据平台选择实现方式：
 * - Web: CSS background-clip: text + @keyframes
 * - Native: 纯色 + textShadow（渐变/动画降级）
 */

import type { NameStyleId } from '@werewolf/game-engine/growth/rewardCatalog';

import { COMMON_NAME_STYLE_CONFIGS, RARE_NAME_STYLE_CONFIGS } from './common';

// ── Types ───────────────────────────────────────────────────────────────────

export type NameStyleTier = 'common' | 'rare' | 'epic' | 'legendary';

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

export const NAME_STYLE_CONFIGS = {
  // ══════════════════════════════════════════════════════════════════════════
  // EPIC (16) — static gradient text, no animation
  // ══════════════════════════════════════════════════════════════════════════

  silverGleam: {
    id: 'silverGleam',
    name: '银光',
    tier: 'epic',
    color: '#6B7D8D',
    gradient: {
      stops: '#8BA4B8 0%, #6B7D8D 40%, #A0C4E0 70%, #6B7D8D 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(170,200,230,0.5))',
    },
  },

  copperEmber: {
    id: 'copperEmber',
    name: '赤铜余烬',
    tier: 'epic',
    color: '#C87533',
    gradient: {
      stops: '#C87533 0%, #E8A060 40%, #FF8C42 70%, #C87533 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(255,140,60,0.45))',
    },
  },

  bloodMoonGlow: {
    id: 'bloodMoonGlow',
    name: '血月',
    tier: 'epic',
    color: '#D42C2C',
    gradient: {
      stops: '#8B0000 0%, #D42C2C 35%, #FF4444 65%, #D42C2C 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(212,44,44,0.5))',
    },
  },

  jadeShimmer: {
    id: 'jadeShimmer',
    name: '翡翠微光',
    tier: 'epic',
    color: '#2D9B5A',
    gradient: {
      stops: '#1B6B3A 0%, #2D9B5A 35%, #5CDB8A 65%, #2D9B5A 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(45,155,90,0.45))',
    },
  },

  amethystGlow: {
    id: 'amethystGlow',
    name: '紫晶',
    tier: 'epic',
    color: '#8B4FC8',
    gradient: {
      stops: '#5B2E8A 0%, #8B4FC8 35%, #C49AFF 65%, #8B4FC8 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(139,79,200,0.45))',
    },
  },

  indigoRadiance: {
    id: 'indigoRadiance',
    name: '靛蓝辉',
    tier: 'epic',
    color: '#5A50F0',
    gradient: {
      stops: '#3730A3 0%, #5A50F0 35%, #8B85FF 65%, #5A50F0 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(90,80,240,0.45))',
    },
  },

  twilightGradient: {
    id: 'twilightGradient',
    name: '暮光渐变',
    tier: 'epic',
    color: '#9B59B6',
    gradient: {
      stops: '#4F46E5 0%, #9B59B6 50%, #E74C3C 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(79,70,229,0.45))',
    },
  },

  roseGold: {
    id: 'roseGold',
    name: '玫瑰金',
    tier: 'epic',
    color: '#B8863A',
    gradient: {
      stops: '#C47090 0%, #B8863A 50%, #C47090 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(184,134,58,0.45))',
    },
  },

  frostVeil: {
    id: 'frostVeil',
    name: '霜纱',
    tier: 'epic',
    color: '#3A8FA8',
    gradient: {
      stops: '#2A6F85 0%, #3A8FA8 35%, #6CC8E0 65%, #3A8FA8 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(80,180,215,0.45))',
    },
  },

  amberFlare: {
    id: 'amberFlare',
    name: '琥珀烈焰',
    tier: 'epic',
    color: '#D4960A',
    gradient: {
      stops: '#A07008 0%, #D4960A 35%, #FFD040 65%, #D4960A 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(212,150,10,0.45))',
    },
  },

  moltenGoldPulse: {
    id: 'moltenGoldPulse',
    name: '熔金脉动',
    tier: 'epic',
    color: '#D4A017',
    gradient: {
      stops: '#B8860B 0%, #D4A017 30%, #FFD700 60%, #D4A017 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(255,215,0,0.5))',
    },
  },

  frostBreath: {
    id: 'frostBreath',
    name: '冰霜呼吸',
    tier: 'epic',
    color: '#2E8EB5',
    gradient: {
      stops: '#2E8EB5 0%, #5BC0EB 50%, #8AD8F5 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(46,142,181,0.5))',
    },
  },

  venomShift: {
    id: 'venomShift',
    name: '剧毒流光',
    tier: 'epic',
    color: '#1A9A4A',
    gradient: {
      stops: '#1A9A4A 0%, #6BCB77 40%, #D4A017 70%, #1A9A4A 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(26,154,74,0.45))',
    },
  },

  shadowPulse: {
    id: 'shadowPulse',
    name: '暗影脉冲',
    tier: 'epic',
    color: '#3D3D55',
    gradient: {
      stops: '#1A1A2E 0%, #3D3D55 30%, #6360E8 60%, #3D3D55 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(61,61,85,0.45))',
    },
  },

  crimsonTide: {
    id: 'crimsonTide',
    name: '赤潮',
    tier: 'epic',
    color: '#C82828',
    gradient: {
      stops: '#C82828 0%, #FF6347 40%, #FF8C42 70%, #C82828 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(200,40,40,0.45))',
    },
  },

  stormElectric: {
    id: 'stormElectric',
    name: '雷暴',
    tier: 'epic',
    color: '#4FC3F7',
    gradient: {
      stops: '#1A73A7 0%, #4FC3F7 35%, #E0F7FF 60%, #4FC3F7 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(79,195,247,0.5))',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LEGENDARY (4) — gradient + multi-animation layered effects (enhanced)
  // ══════════════════════════════════════════════════════════════════════════

  phoenixRebirth: {
    id: 'phoenixRebirth',
    name: '凤凰涅槃',
    tier: 'legendary',
    color: '#FF4500',
    gradient: {
      stops: '#FF4500 0%, #FFD700 25%, #FF6347 50%, #FFAA00 75%, #FF4500 100%',
      backgroundSize: '200% 100%',
      dropShadow: 'drop-shadow(0 0 8px rgba(255,69,0,0.7))',
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
        keyframes: `0%, 100% { filter: drop-shadow(0 0 4px rgba(255,69,0,0.5)); }
    25% { filter: drop-shadow(0 0 12px rgba(255,215,0,0.95)) drop-shadow(0 0 6px rgba(255,100,0,0.7)); }
    75% { filter: drop-shadow(0 0 8px rgba(255,165,0,0.75)) drop-shadow(0 0 3px rgba(255,69,0,0.5)); }`,
      },
      {
        name: 'phoenixScale',
        duration: '4s',
        timing: 'ease-in-out',
        keyframes: `0%, 100% { transform: scale(1); letter-spacing: 0; }
    50% { transform: scale(1.02); letter-spacing: 0.5px; }`,
      },
    ],
  },

  voidStar: {
    id: 'voidStar',
    name: '星渊',
    tier: 'legendary',
    color: '#4F46E5',
    gradient: {
      stops: '#0D0D2B 0%, #4F46E5 20%, #818CF8 40%, #C084FC 60%, #4F46E5 80%, #0D0D2B 100%',
      backgroundSize: '300% 100%',
      dropShadow: 'drop-shadow(0 0 8px rgba(129,140,248,0.7))',
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
        keyframes: `0%, 100% { filter: drop-shadow(0 0 4px rgba(129,140,248,0.5)); }
    30% { filter: drop-shadow(0 0 14px rgba(79,70,229,0.95)) drop-shadow(0 0 6px rgba(192,132,252,0.7)); }
    60% { filter: drop-shadow(0 0 8px rgba(129,140,248,0.7)); }`,
      },
      {
        name: 'voidStarPulse',
        duration: '6s',
        timing: 'ease-in-out',
        keyframes: `0%, 100% { opacity: 1; }
    50% { opacity: 0.88; }`,
      },
    ],
  },

  dragonBreath: {
    id: 'dragonBreath',
    name: '龙息',
    tier: 'legendary',
    color: '#FF4500',
    gradient: {
      stops: '#8B0000 0%, #FF4500 20%, #FFD700 45%, #FF4500 70%, #8B0000 100%',
      backgroundSize: '250% 100%',
      dropShadow: 'drop-shadow(0 0 8px rgba(255,69,0,0.7))',
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
        keyframes: `0%, 100% { filter: drop-shadow(0 0 4px rgba(255,69,0,0.5)); }
    25% { filter: drop-shadow(0 0 14px rgba(255,215,0,0.95)) drop-shadow(0 0 8px rgba(139,0,0,0.7)); }
    75% { filter: drop-shadow(0 0 8px rgba(255,165,0,0.75)) drop-shadow(0 0 4px rgba(255,69,0,0.5)); }`,
      },
      {
        name: 'dragonScale',
        duration: '5s',
        timing: 'ease-in-out',
        keyframes: `0%, 100% { transform: scale(1); }
    50% { transform: scale(1.03); }`,
      },
    ],
  },

  celestialDawn: {
    id: 'celestialDawn',
    name: '天际曙光',
    tier: 'legendary',
    color: '#C87DA8',
    gradient: {
      stops:
        '#3730A3 0%, #6366C8 15%, #C87DA8 35%, #D49A10 55%, #C87DA8 75%, #6366C8 90%, #3730A3 100%',
      backgroundSize: '300% 100%',
      dropShadow: 'drop-shadow(0 0 8px rgba(249,168,212,0.65))',
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
        keyframes: `0%, 100% { filter: drop-shadow(0 0 4px rgba(249,168,212,0.45)); }
    25% { filter: drop-shadow(0 0 12px rgba(251,191,36,0.9)) drop-shadow(0 0 6px rgba(129,140,248,0.7)); }
    75% { filter: drop-shadow(0 0 8px rgba(200,125,168,0.7)) drop-shadow(0 0 4px rgba(99,102,200,0.5)); }`,
      },
      {
        name: 'celestialScale',
        duration: '7s',
        timing: 'ease-in-out',
        keyframes: `0%, 100% { transform: scale(1); letter-spacing: 0; }
    50% { transform: scale(1.02); letter-spacing: 0.3px; }`,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // COMMON (100) + RARE (50) — factory-generated from palette
  // ══════════════════════════════════════════════════════════════════════════
  ...COMMON_NAME_STYLE_CONFIGS,
  ...RARE_NAME_STYLE_CONFIGS,
} as Record<NameStyleId, NameStyleConfig>;
