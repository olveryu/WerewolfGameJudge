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
  // EPIC (46) — static gradient text, no animation
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

  // ── New Epic batch (30) — structurally diverse gradient configs ──────────

  obsidianFlame: {
    id: 'obsidianFlame',
    name: '黑曜之焰',
    tier: 'epic',
    color: '#2D2D2D',
    gradient: {
      stops: '#0A0A0A 0%, #2D2D2D 20%, #FF4500 45%, #FF6A00 55%, #2D2D2D 80%, #0A0A0A 100%',
      dropShadow: 'drop-shadow(0 1px 4px rgba(255,69,0,0.6))',
    },
  },

  sapphireGlow: {
    id: 'sapphireGlow',
    name: '蓝宝石辉',
    tier: 'epic',
    color: '#1565C0',
    gradient: {
      stops: '#0D47A1 0%, #1976D2 40%, #E3F2FD 52%, #1976D2 60%, #0D47A1 100%',
      dropShadow: 'drop-shadow(0 0 5px rgba(25,118,210,0.55))',
    },
  },

  emeraldMist: {
    id: 'emeraldMist',
    name: '翠雾',
    tier: 'epic',
    color: '#2E7D32',
    gradient: {
      stops: '#1B5E20 0%, #388E3C 25%, #81C784 50%, #388E3C 75%, #1B5E20 100%',
      dropShadow: 'drop-shadow(1px 0 3px rgba(56,142,60,0.4))',
    },
  },

  rubyShimmer: {
    id: 'rubyShimmer',
    name: '红宝石微光',
    tier: 'epic',
    color: '#C62828',
    gradient: {
      stops:
        '#7F0000 0%, #C62828 30%, #FF8A80 48%, #FFFFFF 50%, #FF8A80 52%, #C62828 70%, #7F0000 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(198,40,40,0.5))',
    },
  },

  topazRadiance: {
    id: 'topazRadiance',
    name: '黄玉辉耀',
    tier: 'epic',
    color: '#F57F17',
    gradient: {
      stops: '#E65100 0%, #FF8F00 20%, #FFD54F 50%, #FF8F00 80%, #E65100 100%',
      dropShadow: 'drop-shadow(0 2px 3px rgba(230,81,0,0.5))',
    },
  },

  onyxPulse: {
    id: 'onyxPulse',
    name: '缟玛瑙脉',
    tier: 'epic',
    color: '#37474F',
    gradient: {
      stops: '#000000 0%, #263238 15%, #546E7A 40%, #263238 60%, #37474F 85%, #000000 100%',
      dropShadow: 'drop-shadow(0 0 2px rgba(84,110,122,0.35))',
    },
  },

  opalBreeze: {
    id: 'opalBreeze',
    name: '蛋白石风',
    tier: 'epic',
    color: '#80CBC4',
    gradient: {
      stops: '#E0F2F1 0%, #80CBC4 18%, #B2DFDB 40%, #4DB6AC 65%, #80CBC4 82%, #E0F2F1 100%',
      dropShadow: 'drop-shadow(0 0 4px rgba(77,182,172,0.4))',
    },
  },

  garnetFlare: {
    id: 'garnetFlare',
    name: '石榴石焰',
    tier: 'epic',
    color: '#AD1457',
    gradient: {
      stops: '#4A0025 0%, #AD1457 35%, #F06292 55%, #AD1457 100%',
      dropShadow: 'drop-shadow(0 1px 5px rgba(173,20,87,0.55))',
    },
  },

  turquoiseTide: {
    id: 'turquoiseTide',
    name: '绿松石潮',
    tier: 'epic',
    color: '#00897B',
    gradient: {
      stops: '#004D40 0%, #00897B 22%, #80CBC4 45%, #00BFA5 68%, #004D40 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(0,191,165,0.45))',
    },
  },

  pearlLuster: {
    id: 'pearlLuster',
    name: '珍珠光泽',
    tier: 'epic',
    color: '#BDBDBD',
    gradient: {
      stops: '#E0E0E0 0%, #F5F5F5 15%, #BDBDBD 35%, #FAFAFA 50%, #9E9E9E 70%, #E0E0E0 100%',
      dropShadow: 'drop-shadow(0 0 2px rgba(250,250,250,0.6))',
    },
  },

  bronzeBlaze: {
    id: 'bronzeBlaze',
    name: '青铜烈焰',
    tier: 'epic',
    color: '#8D6E63',
    gradient: {
      stops: '#3E2723 0%, #6D4C41 30%, #D7CCC8 48%, #8D6E63 65%, #3E2723 100%',
      dropShadow: 'drop-shadow(1px 1px 3px rgba(62,39,35,0.5))',
    },
  },

  ivoryFrost: {
    id: 'ivoryFrost',
    name: '象牙霜',
    tier: 'epic',
    color: '#D7CCC8',
    gradient: {
      stops: '#EFEBE9 0%, #D7CCC8 45%, #A1887F 55%, #D7CCC8 100%',
      dropShadow: 'drop-shadow(0 0 2px rgba(161,136,127,0.3))',
    },
  },

  platinumSheen: {
    id: 'platinumSheen',
    name: '铂金光泽',
    tier: 'epic',
    color: '#90A4AE',
    gradient: {
      stops:
        '#455A64 0%, #78909C 20%, #CFD8DC 42%, #ECEFF1 50%, #CFD8DC 58%, #78909C 80%, #455A64 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(207,216,220,0.5))',
    },
  },

  coralSunrise: {
    id: 'coralSunrise',
    name: '珊瑚日出',
    tier: 'epic',
    color: '#FF7043',
    gradient: {
      stops: '#BF360C 0%, #FF5722 25%, #FFAB91 50%, #FFD180 75%, #FF7043 100%',
      dropShadow: 'drop-shadow(0 2px 4px rgba(191,54,12,0.45))',
    },
  },

  lavenderDusk: {
    id: 'lavenderDusk',
    name: '薰衣草暮色',
    tier: 'epic',
    color: '#7E57C2',
    gradient: {
      stops: '#311B92 0%, #512DA8 30%, #B39DDB 60%, #7E57C2 100%',
      dropShadow: 'drop-shadow(0 0 4px rgba(81,45,168,0.5))',
    },
  },

  cinnabarGlow: {
    id: 'cinnabarGlow',
    name: '朱砂辉',
    tier: 'epic',
    color: '#E53935',
    gradient: {
      stops: '#B71C1C 0%, #E53935 20%, #FF8A80 40%, #E53935 60%, #FF5252 80%, #B71C1C 100%',
      dropShadow: 'drop-shadow(0 1px 3px rgba(183,28,28,0.5))',
    },
  },

  cobaltStorm: {
    id: 'cobaltStorm',
    name: '钴蓝风暴',
    tier: 'epic',
    color: '#1E88E5',
    gradient: {
      stops: '#0D47A1 0%, #1565C0 15%, #42A5F5 45%, #1E88E5 70%, #0D47A1 100%',
      dropShadow: 'drop-shadow(0 0 5px rgba(13,71,161,0.55))',
    },
  },

  malachiteShift: {
    id: 'malachiteShift',
    name: '孔雀石流转',
    tier: 'epic',
    color: '#00897B',
    gradient: {
      stops: '#004D40 0%, #00695C 18%, #26A69A 42%, #B2DFDB 58%, #004D40 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(0,105,92,0.45))',
    },
  },

  tanzaniteDream: {
    id: 'tanzaniteDream',
    name: '坦桑石梦',
    tier: 'epic',
    color: '#5C6BC0',
    gradient: {
      stops: '#1A237E 0%, #3949AB 25%, #7986CB 50%, #9FA8DA 65%, #3949AB 85%, #1A237E 100%',
      dropShadow: 'drop-shadow(0 0 4px rgba(57,73,171,0.5))',
    },
  },

  citrineWarm: {
    id: 'citrineWarm',
    name: '黄水晶暖',
    tier: 'epic',
    color: '#FDD835',
    gradient: {
      stops: '#F57F17 0%, #FBC02D 30%, #FFF9C4 50%, #FDD835 70%, #F57F17 100%',
      dropShadow: 'drop-shadow(0 1px 3px rgba(245,127,23,0.45))',
    },
  },

  moonlitSilver: {
    id: 'moonlitSilver',
    name: '月照银辉',
    tier: 'epic',
    color: '#B0BEC5',
    gradient: {
      stops: '#546E7A 0%, #90A4AE 28%, #ECEFF1 50%, #B0BEC5 72%, #546E7A 100%',
      dropShadow: 'drop-shadow(0 0 4px rgba(236,239,241,0.5))',
    },
  },

  sunsetEmber: {
    id: 'sunsetEmber',
    name: '落日余烬',
    tier: 'epic',
    color: '#FF8F00',
    gradient: {
      stops: '#BF360C 0%, #E65100 20%, #FF8F00 40%, #FFD54F 60%, #FF8F00 80%, #BF360C 100%',
      dropShadow: 'drop-shadow(0 2px 4px rgba(191,54,12,0.5))',
    },
  },

  auroraBoreal: {
    id: 'auroraBoreal',
    name: '北极光',
    tier: 'epic',
    color: '#26A69A',
    gradient: {
      stops: '#00695C 0%, #26A69A 20%, #66BB6A 40%, #42A5F5 60%, #AB47BC 80%, #26A69A 100%',
      dropShadow: 'drop-shadow(0 0 5px rgba(38,166,154,0.55))',
    },
  },

  midnightVelvet: {
    id: 'midnightVelvet',
    name: '午夜天鹅绒',
    tier: 'epic',
    color: '#283593',
    gradient: {
      stops: '#0D0D2B 0%, #1A237E 40%, #3F51B5 55%, #1A237E 70%, #0D0D2B 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(26,35,126,0.5))',
    },
  },

  desertGold: {
    id: 'desertGold',
    name: '沙漠金',
    tier: 'epic',
    color: '#C8A415',
    gradient: {
      stops: '#795548 0%, #A68B00 25%, #FFD740 50%, #C8A415 75%, #795548 100%',
      dropShadow: 'drop-shadow(1px 1px 3px rgba(121,85,72,0.45))',
    },
  },

  arcticCrystal: {
    id: 'arcticCrystal',
    name: '极地冰晶',
    tier: 'epic',
    color: '#4FC3F7',
    gradient: {
      stops: '#01579B 0%, #0288D1 20%, #4FC3F7 40%, #E1F5FE 55%, #4FC3F7 75%, #01579B 100%',
      dropShadow: 'drop-shadow(0 0 4px rgba(2,136,209,0.5))',
    },
  },

  volcanicAsh: {
    id: 'volcanicAsh',
    name: '火山灰烬',
    tier: 'epic',
    color: '#616161',
    gradient: {
      stops: '#212121 0%, #424242 22%, #FF5722 48%, #FF8A65 52%, #424242 78%, #212121 100%',
      dropShadow: 'drop-shadow(0 1px 4px rgba(255,87,34,0.45))',
    },
  },

  oceanBreeze: {
    id: 'oceanBreeze',
    name: '海风拂面',
    tier: 'epic',
    color: '#0097A7',
    gradient: {
      stops: '#006064 0%, #00838F 30%, #4DD0E1 55%, #B2EBF2 65%, #00838F 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(0,131,143,0.45))',
    },
  },

  thunderGold: {
    id: 'thunderGold',
    name: '雷霆金',
    tier: 'epic',
    color: '#F9A825',
    gradient: {
      stops:
        '#E65100 0%, #F57F17 15%, #F9A825 35%, #FFF176 50%, #F9A825 65%, #F57F17 85%, #E65100 100%',
      dropShadow: 'drop-shadow(0 0 5px rgba(249,168,37,0.55))',
    },
  },

  forestDew: {
    id: 'forestDew',
    name: '林间晨露',
    tier: 'epic',
    color: '#43A047',
    gradient: {
      stops: '#1B5E20 0%, #2E7D32 25%, #A5D6A7 48%, #E8F5E9 52%, #43A047 75%, #1B5E20 100%',
      dropShadow: 'drop-shadow(0 0 3px rgba(46,125,50,0.4))',
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
