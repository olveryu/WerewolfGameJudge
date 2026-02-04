/**
 * Utils 统一导出入口
 *
 * 规则（详见 docs/random-and-id-guidelines.md）：
 * - ID/nonce：用 id.ts（不可预测、不复现）
 * - 可测试随机：用 random.ts（rng 注入）
 * - 跨端一致随机：Host resolve + Broadcast（禁止客户端 random）
 *
 * 禁止：
 * - 在 UI render/useMemo 里使用 Math.random()
 * - 新建"randomXxx.ts"或"RandomUtil.ts"
 */

// ID / Nonce 生成（不可预测、不复现）
export { randomHex, newRequestId, newRejectionId } from './id';

// 可测试随机（支持 rng 注入）
export { secureRng, randomIntInclusive, randomBool, type Rng } from './random';

// 数组打乱（支持 rng 注入）
export { shuffleArray } from './shuffle';

// 其他常用 utils
export { withTimeout, cancellableDelay, type TimeoutErrorFactory } from './withTimeout';
export { showAlert, showPrompt, setAlertListener, type AlertButton, type AlertConfig } from './alert';
export { getAvatarImage, getUniqueAvatarBySeat, getAvatarByUid, AVATAR_COUNT } from './avatar';
export { generateRoomCode } from './roomCode';
