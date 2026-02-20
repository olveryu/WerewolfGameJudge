/**
 * Audio key override — 双预言家标签音频重写
 *
 * 当 seer + mirrorSeer 同时在场时，`seerLabelMap` 会在 ASSIGN_ROLES 阶段随机生成，
 * 记录各角色对应的编号（1 或 2）。本函数将原始 audioKey 映射到编号化的音频文件 key。
 *
 * 规则：
 * - 有 seerLabelMap 且 audioKey 为 `'seer'` → `'seer_1'` / `'seer_2'`
 * - 有 seerLabelMap 且 audioKey 为 `'mirrorSeer'` → `'seer_1'` / `'seer_2'`
 * - 其余情况原样返回
 *
 * 不处理仅 mirrorSeer 独立在场的情况——此时无 seerLabelMap，mirrorSeer 的原始音频
 * 直接播放"预言家请睁眼"。
 */
export function resolveSeerAudioKey(
  audioKey: string,
  seerLabelMap?: Readonly<Record<string, number>>,
): string {
  if (!seerLabelMap) return audioKey;

  if (audioKey === 'seer' && seerLabelMap['seer'] != null) {
    return `seer_${seerLabelMap['seer']}`;
  }
  if (audioKey === 'mirrorSeer' && seerLabelMap['mirrorSeer'] != null) {
    return `seer_${seerLabelMap['mirrorSeer']}`;
  }

  return audioKey;
}
