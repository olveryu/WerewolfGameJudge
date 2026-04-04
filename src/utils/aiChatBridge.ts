/**
 * aiChatBridge - 跨组件 AI 聊天消息桥接
 *
 * Module-level singleton callback，允许非 AIChatBubble 组件（如 NotepadScreen）
 * 请求 AI 聊天发送消息。模式与 alert.ts 的 setAlertListener 一致。
 * 不引入 React 组件、service 或游戏状态。
 */

interface AIChatBridgePayload {
  /** 发送给 AI 的完整文本（含笔记内容 + prompt） */
  fullText: string;
  /** 在用户消息气泡中显示的简短文本 */
  displayText: string;
  /** 可选的 maxTokens 覆盖（默认走 API_CONFIG.maxTokens） */
  maxTokens?: number;
}

type AIChatBridgeListener = (payload: AIChatBridgePayload) => void;

let listener: AIChatBridgeListener | null = null;

/**
 * 注册监听器（AIChatBubble mount 时调用）。
 * 传 null 清除。
 */
export function setAIChatBridgeListener(cb: AIChatBridgeListener | null): void {
  listener = cb;
}

/**
 * 请求 AI 聊天发送一条消息。
 * 如果监听器未注册则静默忽略。
 */
export function requestAIChatMessage(payload: AIChatBridgePayload): void {
  listener?.(payload);
}
