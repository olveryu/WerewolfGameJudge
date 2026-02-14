/**
 * @werewolf/game-engine - 纯游戏逻辑共享包
 *
 * 包含模型定义、游戏引擎（handlers + reducer + store）、
 * resolver、协议类型等，可被客户端和服务端同时 import。
 *
 * ✅ 允许：纯逻辑、类型定义、声明式配置
 * ❌ 禁止：React Native / Expo UI 依赖
 */

// === Utils (platform-agnostic) ===
export { newRejectionId, newRequestId, randomHex } from './utils/id';
export { type EngineLogger, getEngineLogger, setEngineLogger } from './utils/logger';
export { type Rng, secureRng } from './utils/random';
export { shuffleArray } from './utils/shuffle';

// === Models ===
export * from './models/actions/RoleAction';
export * from './models/actions/WitchAction';
export * from './models/GameStatus';
export * from './models/roles';
export * from './models/Template';

// === Protocol ===
export * from './protocol/reasonCodes';
export * from './protocol/types';

// === Types ===
export * from './types/RoleRevealAnimation';

// === Resolvers ===
export * from './resolvers';
export * from './resolvers/types';

// === Engine (helpers) ===
export { resolveWolfVotes } from './engine/resolveWolfVotes';

// (remaining engine code will be populated in Commit 4)
