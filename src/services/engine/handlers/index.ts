/**
 * Handlers Module - Intent 处理器
 *
 * 将 Intent 转换为 StateAction
 */

// Types
export type { Handler, HandlerContext, HandlerResult } from './types';

// Seat handlers
export { handleJoinSeat, handleLeaveMySeat } from './seatHandler';

// Game control handlers
export { handleStartGame, handleRestartGame, handleUpdateTemplate } from './gameControlHandler';

// Action handlers
export { handleSubmitAction, handleSubmitWolfVote, handleViewedRole } from './actionHandler';

// Night flow handlers (PR6, PR7)
export { handleAdvanceNight, handleEndNight, handleSetAudioPlaying } from './nightFlowHandler';
