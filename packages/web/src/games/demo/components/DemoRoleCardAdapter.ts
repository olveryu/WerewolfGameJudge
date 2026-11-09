/**
 * Demo 身份 → 通用 RevealRoleData 适配器。
 *
 * TODO(gameplay): 身份构成定稿后，在这里把每个身份映射到展示名、阵营
 * （视觉主题）、立绘与结构化介绍；介绍文案与说明页/图鉴同源消费，
 * 不许在别处再手写一份。
 */
import { DEMO_TODO_IDENTITY } from '@game-judge/game-engine/games/demo/public';

import type { RevealRoleData } from '@/features/room/model/RevealRoleData';

/** 将本游戏身份转换为通用揭示数据。 */
export function toRevealRoleData(identity: string): RevealRoleData {
  if (identity === DEMO_TODO_IDENTITY) {
    return {
      id: identity,
      name: '待定身份',
      alignment: 'neutral',
      description: 'TODO(gameplay):身份介绍随身份构成定稿后填写。',
    };
  }
  return {
    id: identity,
    name: identity,
    alignment: 'neutral',
    description: 'TODO(gameplay):身份介绍随身份构成定稿后填写。',
  };
}
