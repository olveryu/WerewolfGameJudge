/** 把剩余秒数格式化为 m:ss（如 75 → "1:15"）。阶段倒计时芯片共用。 */
export function formatCountdownSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/** 全员提交后的结算状态句：投票与出牌两种提交共用一份措辞。 */
export type SettleSubmissionKind = '投票' | '出牌';

/** Format the pending reveal or settlement after every participant submits. */
export function formatSettleCountdown(
  remainingSeconds: number | null,
  kind: SettleSubmissionKind,
  outcome: '揭晓' | '结算' = '揭晓',
): string {
  return remainingSeconds !== null && remainingSeconds > 0
    ? `已全部${kind}，${remainingSeconds} 秒后${outcome}`
    : `已全部${kind}，等待${outcome}`;
}
