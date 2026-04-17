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

  // ══════════════════════════════════════════════════════════════════════════
  // COMMON (50) — simple single-color text with subtle shadow
  // ══════════════════════════════════════════════════════════════════════════

  plainCrimson: {
    id: 'plainCrimson',
    name: '绯红',
    tier: 'common',
    color: '#DC2626',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(220,38,38,0.3)' }],
  },
  plainCoral: {
    id: 'plainCoral',
    name: '珊瑚',
    tier: 'common',
    color: '#F97316',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(249,115,22,0.3)' }],
  },
  plainSalmon: {
    id: 'plainSalmon',
    name: '鲑粉',
    tier: 'common',
    color: '#E8795A',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(232,121,90,0.3)' }],
  },
  plainRose: {
    id: 'plainRose',
    name: '玫红',
    tier: 'common',
    color: '#E11D7B',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(225,29,123,0.3)' }],
  },
  plainBlush: {
    id: 'plainBlush',
    name: '腮红',
    tier: 'common',
    color: '#DB2777',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(219,39,119,0.3)' }],
  },
  plainTangerine: {
    id: 'plainTangerine',
    name: '橘色',
    tier: 'common',
    color: '#EA8C34',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(234,140,52,0.3)' }],
  },
  plainApricot: {
    id: 'plainApricot',
    name: '杏色',
    tier: 'common',
    color: '#D97C3F',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(217,124,63,0.3)' }],
  },
  plainPeach: {
    id: 'plainPeach',
    name: '蜜桃',
    tier: 'common',
    color: '#D4845F',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(212,132,95,0.3)' }],
  },
  plainAmber: {
    id: 'plainAmber',
    name: '蜜糖',
    tier: 'common',
    color: '#D4A017',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(212,160,23,0.3)' }],
  },
  plainHoney: {
    id: 'plainHoney',
    name: '蜂蜜',
    tier: 'common',
    color: '#CA8A04',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(202,138,4,0.3)' }],
  },
  plainSunbeam: {
    id: 'plainSunbeam',
    name: '日光',
    tier: 'common',
    color: '#CCAD14',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(204,173,20,0.3)' }],
  },
  plainMarigold: {
    id: 'plainMarigold',
    name: '金盏',
    tier: 'common',
    color: '#C8901E',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(200,144,30,0.3)' }],
  },
  plainLemon: {
    id: 'plainLemon',
    name: '柠檬',
    tier: 'common',
    color: '#B8A210',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(184,162,16,0.3)' }],
  },
  plainCanary: {
    id: 'plainCanary',
    name: '金丝',
    tier: 'common',
    color: '#B8960C',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(184,150,12,0.3)' }],
  },
  plainButtercup: {
    id: 'plainButtercup',
    name: '金黄',
    tier: 'common',
    color: '#BF8F20',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(191,143,32,0.3)' }],
  },
  plainMint: {
    id: 'plainMint',
    name: '薄荷',
    tier: 'common',
    color: '#3EB489',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(62,180,137,0.3)' }],
  },
  plainSage: {
    id: 'plainSage',
    name: '灰绿',
    tier: 'common',
    color: '#6B9B5B',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(107,155,91,0.3)' }],
  },
  plainOlive: {
    id: 'plainOlive',
    name: '橄榄',
    tier: 'common',
    color: '#6B8E23',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(107,142,35,0.3)' }],
  },
  plainFern: {
    id: 'plainFern',
    name: '蕨绿',
    tier: 'common',
    color: '#4F7942',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(79,121,66,0.3)' }],
  },
  plainMoss: {
    id: 'plainMoss',
    name: '苔藓',
    tier: 'common',
    color: '#6B7D45',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(107,125,69,0.3)' }],
  },
  plainSky: {
    id: 'plainSky',
    name: '天蓝',
    tier: 'common',
    color: '#4A90D9',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(74,144,217,0.3)' }],
  },
  plainAzure: {
    id: 'plainAzure',
    name: '湛蓝',
    tier: 'common',
    color: '#3B82F6',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(59,130,246,0.3)' }],
  },
  plainCobalt: {
    id: 'plainCobalt',
    name: '钴蓝',
    tier: 'common',
    color: '#2563EB',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(37,99,235,0.3)' }],
  },
  plainNavy: {
    id: 'plainNavy',
    name: '藏青',
    tier: 'common',
    color: '#1E40AF',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(30,64,175,0.3)' }],
  },
  plainSteel: {
    id: 'plainSteel',
    name: '钢蓝',
    tier: 'common',
    color: '#4682B4',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(70,130,180,0.3)' }],
  },
  plainLavender: {
    id: 'plainLavender',
    name: '淡紫',
    tier: 'common',
    color: '#8B5CF6',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(139,92,246,0.3)' }],
  },
  plainOrchid: {
    id: 'plainOrchid',
    name: '兰紫',
    tier: 'common',
    color: '#9333EA',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(147,51,234,0.3)' }],
  },
  plainPlum: {
    id: 'plainPlum',
    name: '梅紫',
    tier: 'common',
    color: '#7E22CE',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(126,34,206,0.3)' }],
  },
  plainViolet: {
    id: 'plainViolet',
    name: '堇紫',
    tier: 'common',
    color: '#6D28D9',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(109,40,217,0.3)' }],
  },
  plainIris: {
    id: 'plainIris',
    name: '鸢尾',
    tier: 'common',
    color: '#5B21B6',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(91,33,182,0.3)' }],
  },
  plainMagenta: {
    id: 'plainMagenta',
    name: '品红',
    tier: 'common',
    color: '#C026D3',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(192,38,211,0.3)' }],
  },
  plainFuchsia: {
    id: 'plainFuchsia',
    name: '洋红',
    tier: 'common',
    color: '#A21CAF',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(162,28,175,0.3)' }],
  },
  plainBerry: {
    id: 'plainBerry',
    name: '浆果',
    tier: 'common',
    color: '#86198F',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(134,25,143,0.3)' }],
  },
  plainWine: {
    id: 'plainWine',
    name: '酒红',
    tier: 'common',
    color: '#881337',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(136,19,55,0.3)' }],
  },
  plainRuby: {
    id: 'plainRuby',
    name: '宝石',
    tier: 'common',
    color: '#BE123C',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(190,18,60,0.3)' }],
  },
  plainIvory: {
    id: 'plainIvory',
    name: '象牙',
    tier: 'common',
    color: '#A89B8C',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(168,155,140,0.3)' }],
  },
  plainPearl: {
    id: 'plainPearl',
    name: '珍珠',
    tier: 'common',
    color: '#94A3B8',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(148,163,184,0.3)' }],
  },
  plainCream: {
    id: 'plainCream',
    name: '奶油',
    tier: 'common',
    color: '#A8A29E',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(168,162,158,0.3)' }],
  },
  plainSnow: {
    id: 'plainSnow',
    name: '雪色',
    tier: 'common',
    color: '#9CA3AF',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(156,163,175,0.3)' }],
  },
  plainCloud: {
    id: 'plainCloud',
    name: '云色',
    tier: 'common',
    color: '#848D9A',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(132,141,154,0.3)' }],
  },
  plainSlate: {
    id: 'plainSlate',
    name: '石板',
    tier: 'common',
    color: '#64748B',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(100,116,139,0.3)' }],
  },
  plainGraphite: {
    id: 'plainGraphite',
    name: '石墨',
    tier: 'common',
    color: '#4B5563',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(75,85,99,0.3)' }],
  },
  plainAsh: {
    id: 'plainAsh',
    name: '灰烬',
    tier: 'common',
    color: '#7C7570',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(124,117,112,0.3)' }],
  },
  plainSmoke: {
    id: 'plainSmoke',
    name: '烟色',
    tier: 'common',
    color: '#737B86',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(115,123,134,0.3)' }],
  },
  plainCharcoal: {
    id: 'plainCharcoal',
    name: '炭色',
    tier: 'common',
    color: '#374151',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(55,65,81,0.3)' }],
  },
  plainCopper: {
    id: 'plainCopper',
    name: '铜色',
    tier: 'common',
    color: '#B87333',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(184,115,51,0.3)' }],
  },
  plainBronze: {
    id: 'plainBronze',
    name: '青铜',
    tier: 'common',
    color: '#A07030',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(160,112,48,0.3)' }],
  },
  plainRust: {
    id: 'plainRust',
    name: '锈色',
    tier: 'common',
    color: '#B7410E',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(183,65,14,0.3)' }],
  },
  plainCinnamon: {
    id: 'plainCinnamon',
    name: '肉桂',
    tier: 'common',
    color: '#C2692E',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(194,105,46,0.3)' }],
  },
  plainChestnut: {
    id: 'plainChestnut',
    name: '栗色',
    tier: 'common',
    color: '#80461B',
    textShadows: [{ offsetX: 0, offsetY: 0, blur: 2, color: 'rgba(128,70,27,0.3)' }],
  },
};
