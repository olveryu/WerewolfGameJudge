/**
 * seatPets — 座位宠物注册表
 *
 * 每个翻牌动画效果 (RoleRevealEffectId) 对应一个伴生宠物。
 * 装备翻牌动画后，座位右下角出现对应宠物，所有玩家可见。
 * 所有宠物动画由 PetCanvas ('use dom' Canvas 2D) 渲染。
 */
import {
  ROLE_REVEAL_EFFECT_IDS,
  type RoleRevealEffectId,
} from '@werewolf/game-engine/growth/rewardCatalog';
import type React from 'react';
import { memo } from 'react';

import PetCanvas from './PetCanvas';

/** Props for all seat pet animation components */
export interface PetProps {
  size: number;
}

interface SeatPetConfig {
  /** 中文显示名 */
  name: string;
  /** Canvas 2D 动画组件 ('use dom') */
  Component: React.ComponentType<PetProps>;
}

function createPetComponent(petId: string): React.ComponentType<PetProps> {
  const Comp = memo<PetProps>(({ size }) => (
    <PetCanvas dom={{ matchContents: true }} size={size} petId={petId} />
  ));
  Comp.displayName = `Pet(${petId})`;
  return Comp;
}

/**
 * 翻牌动画 → 座位宠物映射（exhaustive Record）。
 * ROLE_REVEAL_EFFECT_IDS 新增 ID 而此处未添加 → TS 编译报错。
 */
const PET_REGISTRY: Record<RoleRevealEffectId, SeatPetConfig> = {
  roulette: { name: '骰灵', Component: createPetComponent('roulette') },
  roleHunt: { name: '猎犬', Component: createPetComponent('roleHunt') },
  scratch: { name: '刮刮猫', Component: createPetComponent('scratch') },
  tarot: { name: '水晶球', Component: createPetComponent('tarot') },
  gachaMachine: { name: '蛋仔', Component: createPetComponent('gachaMachine') },
  cardPick: { name: '牌灵', Component: createPetComponent('cardPick') },
  sealBreak: { name: '印兽', Component: createPetComponent('sealBreak') },
  chainShatter: { name: '锁龙', Component: createPetComponent('chainShatter') },
  fortuneWheel: { name: '幸运星', Component: createPetComponent('fortuneWheel') },
  meteorStrike: { name: '陨石仔', Component: createPetComponent('meteorStrike') },
  filmRewind: { name: '胶片虫', Component: createPetComponent('filmRewind') },
  vortexCollapse: { name: '漩涡眼', Component: createPetComponent('vortexCollapse') },
};

/** 所有座位宠物列表（顺序 = ROLE_REVEAL_EFFECT_IDS） */
const SEAT_PETS: readonly (SeatPetConfig & { id: RoleRevealEffectId })[] =
  ROLE_REVEAL_EFFECT_IDS.map((id) => ({ id, ...PET_REGISTRY[id] }));

const PET_MAP = new Map<string, SeatPetConfig>(SEAT_PETS.map((p) => [p.id, p]));

/** 按翻牌动画效果 ID 获取座位宠物配置。无效 / none / random → undefined。 */
export function getPetByEffectId(effectId: string | null | undefined): SeatPetConfig | undefined {
  if (!effectId) return undefined;
  return PET_MAP.get(effectId);
}
