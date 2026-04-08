/**
 * Shared Resolver Utilities — DRY 提取
 *
 * 提供通用常量，消除 resolver 间的重复逻辑。
 * 仅包含纯函数和常量，不包含 IO。
 */

/**
 * 反转预言家查验结果：'好人' → '狼人'，'狼人' → '好人'
 *
 * 被 mirrorSeer（固定反转）和 drunkSeer（随机反转）共用。
 */
export function invertCheckResult(result: '好人' | '狼人'): '好人' | '狼人' {
  return result === '好人' ? '狼人' : '好人';
}
