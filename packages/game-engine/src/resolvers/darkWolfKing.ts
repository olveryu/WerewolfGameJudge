/**
 * Dark Wolf King Confirm Resolver (HOST-ONLY, 纯函数)
 *
 * 职责：校验黑狼王确认行动（仅确认身份，无目标选择），
 * 导出确认行动校验。不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import type { ResolverFn } from './types';

export const darkWolfKingConfirmResolver: ResolverFn = () => {
  // Dark wolf king confirm is always valid
  // Block guard (blocked → reject confirmed=true; not blocked → reject skip) is at handler layer
  return {
    valid: true,
    result: {},
  };
};
