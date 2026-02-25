/**
 * MirrorSeer Resolver (HOST-ONLY, 纯函数)
 *
 * 灯影预言家查验行动：返回反转后的目标阵营。
 * 查验结果与真实阵营相反：wolf → '好人'，good/third → '狼人'。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { createSeerCheckResolver, invertCheckResult } from './shared';

/** MirrorSeer: 反转查验结果 */
export const mirrorSeerCheckResolver = createSeerCheckResolver(
  'mirrorSeerCheck',
  invertCheckResult,
);
