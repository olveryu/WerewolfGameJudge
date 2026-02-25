/**
 * WildChild Resolver (SERVER-ONLY, 纯函数)
 *
 * 野孩子选择偶像行动：选择一名非自己的玩家作为榜样。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * RULE: canSkip=false — 必须选目标（被 nightmare 阻断时例外，handler 层允许 skip）。
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { createChooseIdolResolver } from './shared';

export const wildChildChooseIdolResolver = createChooseIdolResolver('wildChildChooseIdol');
