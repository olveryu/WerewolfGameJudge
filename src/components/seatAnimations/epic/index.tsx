/**
 * Epic seat animation factory — 40 hand-themed entrance animations.
 *
 * Each epic uses one of 8 archetype templates with unique config (colors, particles,
 * timing, shapes). Visually distinct through parameterization.
 *
 * Archetype mapping:
 * - ParticleBurst (7): bloodMist, poisonDrip, inkSplash, sandstorm, petalStorm, phoenixAsh, prismRefract
 * - SlashReveal (5): wolfClaw, shadowStep, chainBreak, mirrorCrack, serpentCoil
 * - RingPortal (5): darkPortal, mysticSeal, runeActivate, gravityWell, sonicBoom
 * - RisingElement (6): moonrise, tombRise, starfall, vineGrow, crystalForm, oceanSurge
 * - VortexSwirl (5): shadowVortex, auroraWave, stormEye, frostShatter, lavaCrack
 * - FlameEnvelope (5): fireRebirth, witchFire, emberTrail, thunderStrike, duskFade
 * - CreatureSwarm (4): batSwarm, crowFlock, spiritChain, clockwork
 * - PhaseShift (3): mirageFade, ghostPhase, voidTear
 */
import type React from 'react';
import { memo } from 'react';

import type { SeatAnimationProps } from '../SeatAnimationProps';
import { type CreatureSwarmConfig, CreatureSwarmEnter } from './CreatureSwarmEnter';
import { type FlameEnvelopeConfig, FlameEnvelopeEnter } from './FlameEnvelopeEnter';
import { type ParticleBurstConfig, ParticleBurstEnter } from './ParticleBurstEnter';
import { type PhaseShiftConfig, PhaseShiftEnter } from './PhaseShiftEnter';
import { type RingPortalConfig, RingPortalEnter } from './RingPortalEnter';
import { type RisingElementConfig, RisingElementEnter } from './RisingElementEnter';
import { type SlashRevealConfig, SlashRevealEnter } from './SlashRevealEnter';
import { type VortexSwirlConfig, VortexSwirlEnter } from './VortexSwirlEnter';

// ── Types ───────────────────────────────────────────────────────────────────

interface EpicAnimationEntry {
  name: string;
  Component: React.ComponentType<SeatAnimationProps>;
}

// ── Archetype wrappers ──────────────────────────────────────────────────────

type AnyConfig =
  | { archetype: 'particleBurst'; config: ParticleBurstConfig }
  | { archetype: 'slashReveal'; config: SlashRevealConfig }
  | { archetype: 'ringPortal'; config: RingPortalConfig }
  | { archetype: 'risingElement'; config: RisingElementConfig }
  | { archetype: 'vortexSwirl'; config: VortexSwirlConfig }
  | { archetype: 'flameEnvelope'; config: FlameEnvelopeConfig }
  | { archetype: 'creatureSwarm'; config: CreatureSwarmConfig }
  | { archetype: 'phaseShift'; config: PhaseShiftConfig };

function createEpicComponent(
  def: AnyConfig,
  displayName: string,
): React.ComponentType<SeatAnimationProps> {
  let Comp: React.ComponentType<SeatAnimationProps>;

  switch (def.archetype) {
    case 'particleBurst': {
      const cfg = def.config;
      Comp = memo<SeatAnimationProps>(function EpicParticleBurst(p) {
        return <ParticleBurstEnter {...p} config={cfg} />;
      });
      Comp.displayName = displayName;
      break;
    }
    case 'slashReveal': {
      const cfg = def.config;
      Comp = memo<SeatAnimationProps>(function EpicSlashReveal(p) {
        return <SlashRevealEnter {...p} config={cfg} />;
      });
      Comp.displayName = displayName;
      break;
    }
    case 'ringPortal': {
      const cfg = def.config;
      Comp = memo<SeatAnimationProps>(function EpicRingPortal(p) {
        return <RingPortalEnter {...p} config={cfg} />;
      });
      Comp.displayName = displayName;
      break;
    }
    case 'risingElement': {
      const cfg = def.config;
      Comp = memo<SeatAnimationProps>(function EpicRisingElement(p) {
        return <RisingElementEnter {...p} config={cfg} />;
      });
      Comp.displayName = displayName;
      break;
    }
    case 'vortexSwirl': {
      const cfg = def.config;
      Comp = memo<SeatAnimationProps>(function EpicVortexSwirl(p) {
        return <VortexSwirlEnter {...p} config={cfg} />;
      });
      Comp.displayName = displayName;
      break;
    }
    case 'flameEnvelope': {
      const cfg = def.config;
      Comp = memo<SeatAnimationProps>(function EpicFlameEnvelope(p) {
        return <FlameEnvelopeEnter {...p} config={cfg} />;
      });
      Comp.displayName = displayName;
      break;
    }
    case 'creatureSwarm': {
      const cfg = def.config;
      Comp = memo<SeatAnimationProps>(function EpicCreatureSwarm(p) {
        return <CreatureSwarmEnter {...p} config={cfg} />;
      });
      Comp.displayName = displayName;
      break;
    }
    case 'phaseShift': {
      const cfg = def.config;
      Comp = memo<SeatAnimationProps>(function EpicPhaseShift(p) {
        return <PhaseShiftEnter {...p} config={cfg} />;
      });
      Comp.displayName = displayName;
      break;
    }
  }

  return Comp;
}

// ── Epic definitions (40 total) ─────────────────────────────────────────────

const EPIC_DEFS: Record<string, { name: string; def: AnyConfig }> = {
  // === ParticleBurst (7) ===
  bloodMistEnter: {
    name: '血雾弥漫',
    def: {
      archetype: 'particleBurst',
      config: {
        color: 'rgb(180,30,30)',
        accentColor: 'rgb(255,100,100)',
        particleCount: 12,
        shape: 'circle',
        spiral: false,
      },
    },
  },
  poisonDripEnter: {
    name: '毒液滴落',
    def: {
      archetype: 'particleBurst',
      config: {
        color: 'rgb(80,180,50)',
        accentColor: 'rgb(180,255,100)',
        particleCount: 10,
        shape: 'circle',
        spiral: true,
      },
    },
  },
  inkSplashEnter: {
    name: '墨汁飞溅',
    def: {
      archetype: 'particleBurst',
      config: {
        color: 'rgb(30,30,40)',
        accentColor: 'rgb(100,100,120)',
        particleCount: 14,
        shape: 'shard',
        spiral: false,
      },
    },
  },
  sandstormEnter: {
    name: '沙暴席卷',
    def: {
      archetype: 'particleBurst',
      config: {
        color: 'rgb(194,154,88)',
        accentColor: 'rgb(230,200,130)',
        particleCount: 16,
        shape: 'shard',
        spiral: true,
      },
    },
  },
  petalStormEnter: {
    name: '花瓣风暴',
    def: {
      archetype: 'particleBurst',
      config: {
        color: 'rgb(230,130,170)',
        accentColor: 'rgb(255,200,220)',
        particleCount: 12,
        shape: 'circle',
        spiral: true,
      },
    },
  },
  phoenixAshEnter: {
    name: '凤凰涅槃',
    def: {
      archetype: 'particleBurst',
      config: {
        color: 'rgb(255,120,30)',
        accentColor: 'rgb(255,200,50)',
        particleCount: 14,
        shape: 'shard',
        spiral: false,
      },
    },
  },
  prismRefractEnter: {
    name: '棱镜折射',
    def: {
      archetype: 'particleBurst',
      config: {
        color: 'rgb(100,200,255)',
        accentColor: 'rgb(255,150,200)',
        particleCount: 10,
        shape: 'shard',
        spiral: true,
      },
    },
  },

  // === SlashReveal (5) ===
  wolfClawEnter: {
    name: '狼爪撕裂',
    def: {
      archetype: 'slashReveal',
      config: {
        color: 'rgb(200,50,50)',
        accentColor: 'rgb(255,150,150)',
        slashCount: 3,
        baseAngle: 30,
      },
    },
  },
  shadowStepEnter: {
    name: '暗影步',
    def: {
      archetype: 'slashReveal',
      config: {
        color: 'rgb(60,0,80)',
        accentColor: 'rgb(150,80,200)',
        slashCount: 4,
        baseAngle: -20,
      },
    },
  },
  chainBreakEnter: {
    name: '断锁挣脱',
    def: {
      archetype: 'slashReveal',
      config: {
        color: 'rgb(160,160,170)',
        accentColor: 'rgb(220,220,230)',
        slashCount: 5,
        baseAngle: 0,
      },
    },
  },
  mirrorCrackEnter: {
    name: '镜面碎裂',
    def: {
      archetype: 'slashReveal',
      config: {
        color: 'rgb(180,220,255)',
        accentColor: 'rgb(255,255,255)',
        slashCount: 5,
        baseAngle: 45,
      },
    },
  },
  serpentCoilEnter: {
    name: '蛇影缠绕',
    def: {
      archetype: 'slashReveal',
      config: {
        color: 'rgb(50,130,50)',
        accentColor: 'rgb(100,200,80)',
        slashCount: 3,
        baseAngle: 60,
      },
    },
  },

  // === RingPortal (5) ===
  darkPortalEnter: {
    name: '暗黑传送门',
    def: {
      archetype: 'ringPortal',
      config: {
        color: 'rgb(80,0,120)',
        glowColor: 'rgba(120,0,180,0.3)',
        ringCount: 3,
        pulse: true,
      },
    },
  },
  mysticSealEnter: {
    name: '神秘封印',
    def: {
      archetype: 'ringPortal',
      config: {
        color: 'rgb(200,180,50)',
        glowColor: 'rgba(255,230,100,0.3)',
        ringCount: 4,
        pulse: false,
      },
    },
  },
  runeActivateEnter: {
    name: '符文激活',
    def: {
      archetype: 'ringPortal',
      config: {
        color: 'rgb(50,150,255)',
        glowColor: 'rgba(80,180,255,0.3)',
        ringCount: 3,
        pulse: true,
      },
    },
  },
  gravityWellEnter: {
    name: '重力陷阱',
    def: {
      archetype: 'ringPortal',
      config: {
        color: 'rgb(100,50,150)',
        glowColor: 'rgba(150,80,200,0.2)',
        ringCount: 4,
        pulse: false,
      },
    },
  },
  sonicBoomEnter: {
    name: '音速冲击',
    def: {
      archetype: 'ringPortal',
      config: {
        color: 'rgb(200,200,220)',
        glowColor: 'rgba(220,220,240,0.2)',
        ringCount: 3,
        pulse: false,
      },
    },
  },

  // === RisingElement (6) ===
  moonriseEnter: {
    name: '月升东方',
    def: {
      archetype: 'risingElement',
      config: {
        color: 'rgb(200,210,255)',
        accentColor: 'rgb(150,160,220)',
        elementCount: 6,
        direction: 'up',
        shape: 'circle',
      },
    },
  },
  tombRiseEnter: {
    name: '墓碑崛起',
    def: {
      archetype: 'risingElement',
      config: {
        color: 'rgb(100,100,110)',
        accentColor: 'rgb(60,60,70)',
        elementCount: 5,
        direction: 'up',
        shape: 'diamond',
      },
    },
  },
  starfallEnter: {
    name: '星落如雨',
    def: {
      archetype: 'risingElement',
      config: {
        color: 'rgb(255,230,100)',
        accentColor: 'rgb(255,200,50)',
        elementCount: 8,
        direction: 'down',
        shape: 'diamond',
      },
    },
  },
  vineGrowEnter: {
    name: '藤蔓生长',
    def: {
      archetype: 'risingElement',
      config: {
        color: 'rgb(60,150,60)',
        accentColor: 'rgb(100,200,80)',
        elementCount: 6,
        direction: 'up',
        shape: 'leaf',
      },
    },
  },
  crystalFormEnter: {
    name: '水晶结晶',
    def: {
      archetype: 'risingElement',
      config: {
        color: 'rgb(150,220,255)',
        accentColor: 'rgb(200,240,255)',
        elementCount: 7,
        direction: 'up',
        shape: 'diamond',
      },
    },
  },
  oceanSurgeEnter: {
    name: '海潮涌动',
    def: {
      archetype: 'risingElement',
      config: {
        color: 'rgb(30,100,180)',
        accentColor: 'rgb(80,180,255)',
        elementCount: 8,
        direction: 'up',
        shape: 'circle',
      },
    },
  },

  // === VortexSwirl (5) ===
  shadowVortexEnter: {
    name: '暗影漩涡',
    def: {
      archetype: 'vortexSwirl',
      config: {
        color: 'rgb(40,0,60)',
        accentColor: 'rgb(100,50,150)',
        particleCount: 10,
        direction: -1,
        rotations: 2,
      },
    },
  },
  auroraWaveEnter: {
    name: '极光波动',
    def: {
      archetype: 'vortexSwirl',
      config: {
        color: 'rgb(50,200,150)',
        accentColor: 'rgb(100,150,255)',
        particleCount: 12,
        direction: 1,
        rotations: 1.5,
      },
    },
  },
  stormEyeEnter: {
    name: '风暴之眼',
    def: {
      archetype: 'vortexSwirl',
      config: {
        color: 'rgb(150,160,180)',
        accentColor: 'rgb(100,120,160)',
        particleCount: 10,
        direction: 1,
        rotations: 2.5,
      },
    },
  },
  frostShatterEnter: {
    name: '冰霜碎裂',
    def: {
      archetype: 'vortexSwirl',
      config: {
        color: 'rgb(180,220,255)',
        accentColor: 'rgb(220,240,255)',
        particleCount: 8,
        direction: -1,
        rotations: 1,
      },
    },
  },
  lavaCrackEnter: {
    name: '熔岩裂纹',
    def: {
      archetype: 'vortexSwirl',
      config: {
        color: 'rgb(255,80,20)',
        accentColor: 'rgb(255,180,50)',
        particleCount: 8,
        direction: 1,
        rotations: 1,
      },
    },
  },

  // === FlameEnvelope (5) ===
  fireRebirthEnter: {
    name: '浴火重生',
    def: {
      archetype: 'flameEnvelope',
      config: {
        color: 'rgb(255,100,20)',
        accentColor: 'rgb(255,200,50)',
        flameCount: 10,
        direction: 'inward',
      },
    },
  },
  witchFireEnter: {
    name: '女巫之火',
    def: {
      archetype: 'flameEnvelope',
      config: {
        color: 'rgb(80,200,80)',
        accentColor: 'rgb(150,255,100)',
        flameCount: 8,
        direction: 'outward',
      },
    },
  },
  emberTrailEnter: {
    name: '余烬拖尾',
    def: {
      archetype: 'flameEnvelope',
      config: {
        color: 'rgb(200,80,30)',
        accentColor: 'rgb(255,150,50)',
        flameCount: 8,
        direction: 'outward',
      },
    },
  },
  thunderStrikeEnter: {
    name: '雷霆一击',
    def: {
      archetype: 'flameEnvelope',
      config: {
        color: 'rgb(200,200,255)',
        accentColor: 'rgb(255,255,200)',
        flameCount: 6,
        direction: 'inward',
      },
    },
  },
  duskFadeEnter: {
    name: '暮色消散',
    def: {
      archetype: 'flameEnvelope',
      config: {
        color: 'rgb(150,80,40)',
        accentColor: 'rgb(200,130,80)',
        flameCount: 8,
        direction: 'outward',
      },
    },
  },

  // === CreatureSwarm (4) ===
  batSwarmEnter: {
    name: '蝙蝠群飞',
    def: {
      archetype: 'creatureSwarm',
      config: {
        color: 'rgb(40,30,50)',
        accentColor: 'rgb(80,60,100)',
        creatureCount: 6,
        shape: 'bat',
      },
    },
  },
  crowFlockEnter: {
    name: '乌鸦成群',
    def: {
      archetype: 'creatureSwarm',
      config: {
        color: 'rgb(20,20,30)',
        accentColor: 'rgb(60,60,80)',
        creatureCount: 5,
        shape: 'bird',
      },
    },
  },
  spiritChainEnter: {
    name: '灵魂锁链',
    def: {
      archetype: 'creatureSwarm',
      config: {
        color: 'rgb(150,200,255)',
        accentColor: 'rgb(200,230,255)',
        creatureCount: 6,
        shape: 'wisp',
      },
    },
  },
  clockworkEnter: {
    name: '齿轮运转',
    def: {
      archetype: 'creatureSwarm',
      config: {
        color: 'rgb(180,150,80)',
        accentColor: 'rgb(220,200,120)',
        creatureCount: 8,
        shape: 'wisp',
      },
    },
  },

  // === PhaseShift (3) ===
  mirageFadeEnter: {
    name: '海市蜃楼',
    def: {
      archetype: 'phaseShift',
      config: {
        color: 'rgb(200,180,150)',
        accentColor: 'rgba(200,180,150,0.3)',
        pattern: 'horizontal',
      },
    },
  },
  ghostPhaseEnter: {
    name: '幽灵穿越',
    def: {
      archetype: 'phaseShift',
      config: {
        color: 'rgb(180,200,255)',
        accentColor: 'rgba(180,200,255,0.3)',
        pattern: 'vertical',
      },
    },
  },
  voidTearEnter: {
    name: '虚空裂隙',
    def: {
      archetype: 'phaseShift',
      config: { color: 'rgb(60,0,80)', accentColor: 'rgba(120,0,200,0.3)', pattern: 'radial' },
    },
  },
};

// ── Build entries ───────────────────────────────────────────────────────────

export const EPIC_ANIMATION_ENTRIES: Record<string, EpicAnimationEntry> = {};

for (const [id, { name, def }] of Object.entries(EPIC_DEFS)) {
  EPIC_ANIMATION_ENTRIES[id] = {
    name,
    Component: createEpicComponent(def, id),
  };
}
