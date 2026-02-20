/**
 * Audio key override — 多预言家标签音频重写
 *
 * 当多个 displayAs='seer' 角色同时在场时，`seerLabelMap` 会在 ASSIGN_ROLES 阶段随机生成，
 * 记录各角色对应的编号（1, 2, ...）。本函数将原始 audioKey 映射到编号化的音频文件 key。
 *
 * 规则：
 * - 有 seerLabelMap 且 audioKey 在 map 中有对应编号 → `'seer_N'`
 * - 其余情况原样返回
 *
 * 不处理仅单个 seer-like 角色在场的情况——此时无 seerLabelMap，角色的原始音频直接播放。
 */
export function resolveSeerAudioKey(
  audioKey: string,
  seerLabelMap?: Readonly<Record<string, number>>,
): string {
  if (!seerLabelMap) return audioKey;

  const label = seerLabelMap[audioKey];
  if (label != null) {
    return `seer_${label}`;
  }

  return audioKey;
}
