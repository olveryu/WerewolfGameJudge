/** 把剩余秒数格式化为 m:ss（如 75 → "1:15"）。阶段倒计时芯片共用。 */
export function formatCountdownSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
