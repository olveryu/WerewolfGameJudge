/**
 * frameUnlock — 头像框解锁条件配置
 *
 * 每个框有一种解锁方式：注册即得 / 等级解锁 / 图鉴收集解锁。
 * 纯数据+查询函数，客户端与服务端共用。
 */

export type FrameUnlockType = 'register' | 'level' | 'collection';

export interface FrameUnlockCondition {
  readonly frameId: string;
  readonly type: FrameUnlockType;
  /** 等级解锁: 所需等级；图鉴解锁: 所需收集角色数 */
  readonly value: number;
  /** 中文描述，用于 UI 展示 */
  readonly description: string;
}

export const FRAME_UNLOCK_CONDITIONS: readonly FrameUnlockCondition[] = [
  { frameId: 'ironForge', type: 'register', value: 0, description: '注册即得' },
  { frameId: 'moonSilver', type: 'level', value: 2, description: '达到 Lv.2' },
  { frameId: 'darkVine', type: 'level', value: 5, description: '达到 Lv.5' },
  { frameId: 'frostCrystal', type: 'level', value: 10, description: '达到 Lv.10' },
  { frameId: 'pharaohGold', type: 'level', value: 15, description: '达到 Lv.15' },
  { frameId: 'boneGate', type: 'collection', value: 5, description: '收集 5 种角色' },
  { frameId: 'runicSeal', type: 'collection', value: 10, description: '收集 10 种角色' },
  { frameId: 'bloodThorn', type: 'collection', value: 20, description: '收集 20 种角色' },
  { frameId: 'hellFire', type: 'collection', value: 30, description: '收集 30 种角色' },
  { frameId: 'voidRift', type: 'collection', value: 40, description: '收集 40 种角色' },
] as const;

const CONDITION_MAP = new Map<string, FrameUnlockCondition>(
  FRAME_UNLOCK_CONDITIONS.map((c) => [c.frameId, c]),
);

/** 获取头像框的解锁条件 */
export function getFrameUnlockCondition(frameId: string): FrameUnlockCondition | undefined {
  return CONDITION_MAP.get(frameId);
}

/** 判断头像框是否已解锁 */
export function isFrameUnlocked(
  frameId: string,
  userLevel: number,
  rolesCollected: number,
): boolean {
  const condition = CONDITION_MAP.get(frameId);
  if (!condition) return false;
  switch (condition.type) {
    case 'register':
      return true;
    case 'level':
      return userLevel >= condition.value;
    case 'collection':
      return rolesCollected >= condition.value;
  }
}
