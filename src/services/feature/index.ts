/**
 * Feature services - business features (AI chat, settings, avatar upload)
 *
 * ✅ 允许：调用 infra 层服务、外部 API、AsyncStorage
 * ❌ 禁止：游戏状态/逻辑（那是 engine 的职责）
 */

export { AvatarUploadService } from './AvatarUploadService';
export { default as SettingsService } from './SettingsService';
export { sendChatMessage, getDefaultApiKey } from './AIChatService';
export type { ChatMessage, ChatResponse, GameContext } from './AIChatService';
