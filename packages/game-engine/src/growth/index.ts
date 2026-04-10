/**
 * @werewolf/game-engine/growth — 成长体系模块
 *
 * 月相经验 + 等级系统 + 头像框解锁。纯函数，客户端与服务端共用。
 */

export {
  FRAME_UNLOCK_CONDITIONS,
  type FrameUnlockCondition,
  type FrameUnlockType,
  getFrameUnlockCondition,
  isFrameUnlocked,
} from './frameUnlock';
export { getLevel, getLevelProgress, getLevelTitle, LEVEL_THRESHOLDS, LEVEL_TITLES } from './level';
export { MOON_PHASES, type MoonPhase, rollMoonPhase } from './moonPhase';
