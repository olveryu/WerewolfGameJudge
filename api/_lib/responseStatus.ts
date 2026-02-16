/**
 * HTTP Response Status Helper
 *
 * 将 GameActionResult 映射到正确的 HTTP 状态码。
 * INTERNAL_ERROR（服务端异常）→ 500；其余失败 → 400；成功 → 200。
 *
 * ✅ 允许：纯状态码映射
 * ❌ 禁止：业务逻辑
 */

/** 从 API result 推导正确的 HTTP 状态码 */
export function resultToStatus(result: { success: boolean; reason?: string }): number {
  if (result.success) return 200;
  return result.reason === 'INTERNAL_ERROR' ? 500 : 400;
}
