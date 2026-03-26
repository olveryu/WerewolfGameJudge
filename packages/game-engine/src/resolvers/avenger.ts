/**
 * Avenger Confirm Resolver (SERVER-ONLY, 纯函数)
 *
 * 职责：校验复仇者确认行动（仅查看阵营信息，无目标选择），
 * 导出确认行动校验。不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import type { ResolverFn } from './types';

export const avengerConfirmResolver: ResolverFn = () => {
  // Avenger confirm is always valid — just viewing faction info
  // Block guard (blocked → reject confirmed=true; not blocked → reject skip) is at handler layer
  return {
    valid: true,
    result: {},
  };
};
