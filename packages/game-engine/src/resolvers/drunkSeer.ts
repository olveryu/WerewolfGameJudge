/**
 * DrunkSeer Resolver (HOST-ONLY, 纯函数)
 *
 * 酒鬼预言家查验行动：返回随机化后的目标阵营。
 * 查验结果随机：50% 概率正确，50% 概率反转。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { secureRng } from '../utils/random';
import { createSeerCheckResolver, invertCheckResult } from './shared';

/** DrunkSeer: 50% 概率反转查验结果 */
export const drunkSeerCheckResolver = createSeerCheckResolver('drunkSeerCheck', (normalResult) => {
  const isCorrect = secureRng() >= 0.5;
  return isCorrect ? normalResult : invertCheckResult(normalResult);
});
