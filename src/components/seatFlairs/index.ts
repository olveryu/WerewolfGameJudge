/**
 * seatFlairs — 座位装饰注册表
 *
 * FlairId 类型从 `@werewolf/game-engine/growth/rewardCatalog` 的 SEAT_FLAIR_IDS 派生。
 * 通过 getFlairById 按 id 获取对应的 Reanimated 动画组件。
 * pattern 同 `avatarFrames/index.ts`。
 */
import { type FlairId, SEAT_FLAIR_IDS } from '@werewolf/game-engine/growth/rewardCatalog';
import type React from 'react';

import { AmberDropFlair } from './AmberDropFlair';
import { ArcticWindFlair } from './ArcticWindFlair';
import { AshCloudFlair } from './AshCloudFlair';
import { AuraBurstFlair } from './AuraBurstFlair';
import { BlazeTrailFlair } from './BlazeTrailFlair';
import { BloodMarkFlair } from './BloodMarkFlair';
import { ButterflyFlair } from './ButterflyFlair';
import { CometTailFlair } from './CometTailFlair';
import { COMMON_FLAIR_ENTRIES, RARE_FLAIR_ENTRIES } from './common';
import { CoralGlowFlair } from './CoralGlowFlair';
import { CrystalShardFlair } from './CrystalShardFlair';
import { DarkSmokeFlair } from './DarkSmokeFlair';
import { DawnLightFlair } from './DawnLightFlair';
import { EclipseRingFlair } from './EclipseRingFlair';
import { EmberGlowFlair } from './EmberGlowFlair';
import { FireflyFlair } from './FireflyFlair';
import { FireRingFlair } from './FireRingFlair';
import type { FlairProps } from './FlairProps';
import { FlowerBloomFlair } from './FlowerBloomFlair';
import { ForestLeafFlair } from './ForestLeafFlair';
import { FrostAuraFlair } from './FrostAuraFlair';
import { GhostWispFlair } from './GhostWispFlair';
import { GoldenShineFlair } from './GoldenShineFlair';
import { GoldSparkFlair } from './GoldSparkFlair';
import { IceCrystalFlair } from './IceCrystalFlair';
import { JadeMistFlair } from './JadeMistFlair';
import { LavaBurstFlair } from './LavaBurstFlair';
import { LightPillarFlair } from './LightPillarFlair';
import { LunarFrostFlair } from './LunarFrostFlair';
import { LunarHaloFlair } from './LunarHaloFlair';
import { MagmaFloatFlair } from './MagmaFloatFlair';
import { MirageHeatFlair } from './MirageHeatFlair';
import { MistVeilFlair } from './MistVeilFlair';
import { MoonBeamFlair } from './MoonBeamFlair';
import { NightGlowFlair } from './NightGlowFlair';
import { ObsidianPulseFlair } from './ObsidianPulseFlair';
import { OceanWaveFlair } from './OceanWaveFlair';
import { PetalDanceFlair } from './PetalDanceFlair';
import { PhoenixFeatherFlair } from './PhoenixFeatherFlair';
import { PoisonBubbleFlair } from './PoisonBubbleFlair';
import { PrismShardFlair } from './PrismShardFlair';
import { PurpleMistFlair } from './PurpleMistFlair';
import { RainDropFlair } from './RainDropFlair';
import { RuneCircleFlair } from './RuneCircleFlair';
import { SakuraFlair } from './SakuraFlair';
import { SandStormFlairFlair } from './SandStormFlairFlair';
import { ShadowClawFlair } from './ShadowClawFlair';
import { ShadowMistFlair } from './ShadowMistFlair';
import { SilverStreamFlair } from './SilverStreamFlair';
import { SnowfallFlair } from './SnowfallFlair';
import { SolarFlareFlair } from './SolarFlareFlair';
import { SonicWaveFlair } from './SonicWaveFlair';
import { StarDustFlair } from './StarDustFlair';
import { StarlightFlair } from './StarlightFlair';
import { StormSurgeFlair } from './StormSurgeFlair';
import { ThornVineFlair } from './ThornVineFlair';
import { ThunderBoltFlair } from './ThunderBoltFlair';
import { ThunderClapFlair } from './ThunderClapFlair';
import { TidePoolFlair } from './TidePoolFlair';
import { VenomDripFlair } from './VenomDripFlair';
import { WillowWispFlair } from './WillowWispFlair';
import { WindGustFlair } from './WindGustFlair';

export type { FlairId };

interface SeatFlairConfig {
  /** 中文显示名 */
  name: string;
  /** SVG + Reanimated 粒子/光效动画组件 */
  Component: React.ComponentType<FlairProps>;
}

/**
 * 座位装饰注册表（exhaustive Record）—— SEAT_FLAIR_IDS 新增 ID 而此处未添加 → TS 编译报错。
 * UI 展示顺序跟随 SEAT_FLAIR_IDS。
 * 静态条目手动列举；Common 50 条从 factory 展开（runtime 由 gachaProbability 测试覆盖）。
 */
function buildFlairRegistry(): Record<FlairId, SeatFlairConfig> {
  const staticEntries: Record<string, SeatFlairConfig> = {
    emberGlow: { name: '余烬微光', Component: EmberGlowFlair },
    frostAura: { name: '寒霜气场', Component: FrostAuraFlair },
    shadowMist: { name: '暗影迷雾', Component: ShadowMistFlair },
    goldenShine: { name: '金色闪耀', Component: GoldenShineFlair },
    bloodMark: { name: '血月印记', Component: BloodMarkFlair },
    starlight: { name: '星光点缀', Component: StarlightFlair },
    thunderBolt: { name: '雷鸣电闪', Component: ThunderBoltFlair },
    sakura: { name: '樱花飘落', Component: SakuraFlair },
    runeCircle: { name: '符文之环', Component: RuneCircleFlair },
    fireRing: { name: '烈焰之环', Component: FireRingFlair },
    lunarHalo: { name: '月华光环', Component: LunarHaloFlair },
    sonicWave: { name: '音波震荡', Component: SonicWaveFlair },
    cometTail: { name: '彗星拖尾', Component: CometTailFlair },
    iceCrystal: { name: '冰晶棱镜', Component: IceCrystalFlair },
    phoenixFeather: { name: '凤凰羽', Component: PhoenixFeatherFlair },
    ghostWisp: { name: '幽灵鬼火', Component: GhostWispFlair },
    poisonBubble: { name: '剧毒气泡', Component: PoisonBubbleFlair },
    magmaFloat: { name: '熔岩浮石', Component: MagmaFloatFlair },
    windGust: { name: '疾风粒子', Component: WindGustFlair },
    snowfall: { name: '纷飞白雪', Component: SnowfallFlair },
    goldSpark: { name: '金星四溅', Component: GoldSparkFlair },
    purpleMist: { name: '紫雾缭绕', Component: PurpleMistFlair },
    butterfly: { name: '蝶影翩翩', Component: ButterflyFlair },
    lightPillar: { name: '四柱天光', Component: LightPillarFlair },
    shadowClaw: { name: '暗影之爪', Component: ShadowClawFlair },
    rainDrop: { name: '细雨绵绵', Component: RainDropFlair },
    flowerBloom: { name: '繁花盛开', Component: FlowerBloomFlair },
    firefly: { name: '萤火虫之夜', Component: FireflyFlair },
    forestLeaf: { name: '落叶知秋', Component: ForestLeafFlair },
    prismShard: { name: '棱镜碎片', Component: PrismShardFlair },
    crystalShard: { name: '水晶碎片', Component: CrystalShardFlair },
    moonBeam: { name: '月光束', Component: MoonBeamFlair },
    darkSmoke: { name: '暗烟升腾', Component: DarkSmokeFlair },
    solarFlare: { name: '日冕耀斑', Component: SolarFlareFlair },
    nightGlow: { name: '夜光虫', Component: NightGlowFlair },
    oceanWave: { name: '海浪涌动', Component: OceanWaveFlair },
    thornVine: { name: '荆棘缠绕', Component: ThornVineFlair },
    mistVeil: { name: '迷雾面纱', Component: MistVeilFlair },
    lavaBurst: { name: '熔岩迸发', Component: LavaBurstFlair },
    starDust: { name: '星尘飘散', Component: StarDustFlair },
    arcticWind: { name: '极地寒风', Component: ArcticWindFlair },
    thunderClap: { name: '惊雷一击', Component: ThunderClapFlair },
    sandStormFlair: { name: '沙暴席卷', Component: SandStormFlairFlair },
    venomDrip: { name: '毒液滴落', Component: VenomDripFlair },
    auraBurst: { name: '灵气爆发', Component: AuraBurstFlair },
    dawnLight: { name: '曙光微照', Component: DawnLightFlair },
    eclipseRing: { name: '日蚀光环', Component: EclipseRingFlair },
    blazeTrail: { name: '烈焰轨迹', Component: BlazeTrailFlair },
    coralGlow: { name: '珊瑚荧光', Component: CoralGlowFlair },
    willowWisp: { name: '柳树鬼火', Component: WillowWispFlair },
    jadeMist: { name: '玉雾弥漫', Component: JadeMistFlair },
    obsidianPulse: { name: '黑曜脉动', Component: ObsidianPulseFlair },
    amberDrop: { name: '琥珀坠落', Component: AmberDropFlair },
    silverStream: { name: '银流蜿蜒', Component: SilverStreamFlair },
    tidePool: { name: '潮汐水洼', Component: TidePoolFlair },
    mirageHeat: { name: '海市蜃楼', Component: MirageHeatFlair },
    petalDance: { name: '花瓣飞舞', Component: PetalDanceFlair },
    stormSurge: { name: '风暴潮涌', Component: StormSurgeFlair },
    ashCloud: { name: '灰烬之云', Component: AshCloudFlair },
    lunarFrost: { name: '月霜凝结', Component: LunarFrostFlair },
  };
  return { ...staticEntries, ...COMMON_FLAIR_ENTRIES, ...RARE_FLAIR_ENTRIES } as Record<
    FlairId,
    SeatFlairConfig
  >;
}
const FLAIR_REGISTRY = buildFlairRegistry();

/** 所有可用座位装饰（顺序 = SEAT_FLAIR_IDS 展示顺序） */
export const SEAT_FLAIRS: readonly (SeatFlairConfig & { id: FlairId })[] = SEAT_FLAIR_IDS.map(
  (id) => ({ id, ...FLAIR_REGISTRY[id] }),
);

const FLAIR_MAP = new Map<string, SeatFlairConfig>(SEAT_FLAIRS.map((f) => [f.id, f]));

/** 按 id 获取座位装饰配置。无效 id 返回 undefined。 */
export function getFlairById(id: string | null | undefined): SeatFlairConfig | undefined {
  if (!id) return undefined;
  return FLAIR_MAP.get(id);
}
