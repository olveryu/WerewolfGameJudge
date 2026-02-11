/**
 * AI Chat Service - Groq (Llama 4 Scout)
 *
 * 使用 Groq 提供 Llama 4 Scout API
 * 免费额度：30K TPM, 1K RPD（TPM 比 Qwen3 高 5 倍）
 * 文档: https://console.groq.com/docs/models
 */

import { log } from '@/utils/logger';

const chatLog = log.extend('AIChatService');

// Groq API 配置 - Llama 4 Scout（TPM 最高，Llama 4 最新架构）
const API_CONFIG = {
  baseURL: 'https://api.groq.com/openai/v1',
  model: 'meta-llama/llama-4-scout-17b-16e-instruct',
  maxTokens: 512, // 优化5: 降低回复长度，节省 tokens
};

// Token 优化配置
const TOKEN_OPTIMIZATION = {
  maxHistoryRounds: 3, // 优化6: 最多保留最近 3 轮对话
};

// 从环境变量获取默认 API Key（用户无需手动配置）
const DEFAULT_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

/**
 * 获取 API Key（优先使用环境变量）
 */
export function getDefaultApiKey(): string {
  return DEFAULT_API_KEY;
}


/**
 * 游戏上下文信息（玩家视角，不包含作弊信息）
 */
export interface GameContext {
  /** 是否在游戏房间中 */
  inRoom: boolean;
  /** 房间号 */
  roomCode?: string;
  /** 游戏状态 */
  status?: 'unseated' | 'seated' | 'assigned' | 'ready' | 'ongoing' | 'ended';
  /** 我的座位号 */
  mySeat?: number;
  /** 我的角色 */
  myRole?: string;
  /** 我的角色名称 */
  myRoleName?: string;
  /** 总人数 */
  totalPlayers?: number;
  /** 板子中每个角色的详细技能描述（公开信息） */
  boardRoleDetails?: Array<{ name: string; description: string }>;
}

/**
 * 构建游戏上下文提示（玩家视角，不泄露其他玩家信息）
 */
function buildGameContextPrompt(context: GameContext): string {
  if (!context.inRoom) {
    return '（用户当前不在游戏房间中）';
  }

  const lines: string[] = ['## 当前游戏状态（玩家视角）', ''];

  if (context.roomCode) {
    lines.push(`- 房间号: ${context.roomCode}`);
  }

  if (context.status) {
    const statusMap: Record<string, string> = {
      unseated: '等待入座',
      seated: '已入座，等待分配角色',
      assigned: '已分配角色，等待查看',
      ready: '已准备，等待开始',
      ongoing: '游戏进行中（第一夜）',
      ended: '游戏已结束',
    };
    lines.push(`- 游戏状态: ${statusMap[context.status] || context.status}`);
  }

  if (context.mySeat !== undefined) {
    lines.push(`- 我的座位: ${context.mySeat + 1} 号`);
  }

  if (context.myRoleName) {
    lines.push(`- 我的身份: ${context.myRoleName}`);
  }

  if (context.totalPlayers) {
    lines.push(`- 总玩家数: ${context.totalPlayers} 人`);
  }

  // boardRoleDetails 已包含角色名，无需单独的 boardRoles
  if (context.boardRoleDetails && context.boardRoleDetails.length > 0) {
    const uniqueRoles = new Map<string, string>();
    context.boardRoleDetails.forEach((r) => {
      if (!uniqueRoles.has(r.name)) {
        uniqueRoles.set(r.name, r.description);
      }
    });
    lines.push(`- 板子配置: ${[...uniqueRoles.keys()].join('、')}`);
    lines.push(`- 本局角色技能:`);
    uniqueRoles.forEach((desc, name) => {
      lines.push(`  - ${name}: ${desc}`);
    });
  }

  lines.push('');

  return lines.join('\n');
}

// 优化1: 移除 getRolesDescription，改用板子上下文中的角色

// 优化3+4: 精简 System Prompt，移除跟进问题要求
const SYSTEM_PROMPT = `你是狼人杀游戏助手。职责：规则解答、策略建议、争议裁决。

回答原则：
- 简洁中文，控制在150字内
- 可用emoji 🐺
- 本App只处理第一夜，白天在线下进行`;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 发送聊天消息到 AI
 * @param messages 聊天消息历史
 * @param apiKey API Key
 * @param gameContext 可选的游戏上下文（玩家视角）
 * @param signal 可选的 AbortSignal，用于取消请求（关闭聊天时中断）
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  apiKey: string,
  gameContext?: GameContext,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  if (!apiKey) {
    return { success: false, error: '请先配置 Groq API Key' };
  }

  try {
    chatLog.debug('Sending chat request', {
      messageCount: messages.length,
      hasContext: !!gameContext,
    });

    // 构建系统提示（包含游戏上下文）
    let systemPrompt = SYSTEM_PROMPT;
    if (gameContext) {
      systemPrompt += '\n\n' + buildGameContextPrompt(gameContext);
    }

    // 优化2: 限制历史轮数，只保留最近 N 轮对话
    const maxMessages = TOKEN_OPTIMIZATION.maxHistoryRounds * 2; // 每轮 = 1 user + 1 assistant
    const trimmedMessages = messages.length > maxMessages ? messages.slice(-maxMessages) : messages;

    const response = await fetch(`${API_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: API_CONFIG.model,
        messages: [{ role: 'system', content: systemPrompt }, ...trimmedMessages],
        max_tokens: API_CONFIG.maxTokens,
        temperature: 0.7,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      chatLog.error('API error', { status: response.status, error: errorText });

      if (response.status === 401) {
        return { success: false, error: 'Groq API Key 无效或未配置，请联系管理员' };
      }
      if (response.status === 429) {
        return { success: false, error: '请求太频繁，请稍后再试' };
      }
      return { success: false, error: `API 错误: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, error: '未收到有效回复' };
    }

    chatLog.debug('Chat response received', { length: content.length });
    return { success: true, message: content };
  } catch (error) {
    // Rethrow AbortError so callers can distinguish cancellation from real failures
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    chatLog.error('Chat request failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
    };
  }
}

// ══════════════════════════════════════════════════════════
// Streaming (SSE)
// ══════════════════════════════════════════════════════════

export interface StreamChunk {
  type: 'delta' | 'done' | 'error';
  content: string;
}

/**
 * 流式发送聊天消息到 AI（SSE）
 *
 * 使用 Groq OpenAI 兼容的 streaming endpoint，逐 token 返回。
 * 调用者用 `for await (const chunk of streamChatMessage(...))` 消费。
 *
 * @param messages 聊天消息历史
 * @param apiKey API Key
 * @param gameContext 可选的游戏上下文
 * @param signal 可选的 AbortSignal
 */
export async function* streamChatMessage(
  messages: ChatMessage[],
  apiKey: string,
  gameContext?: GameContext,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  if (!apiKey) {
    yield { type: 'error', content: '请先配置 Groq API Key' };
    return;
  }

  let systemPrompt = SYSTEM_PROMPT;
  if (gameContext) {
    systemPrompt += '\n\n' + buildGameContextPrompt(gameContext);
  }

  const maxMessages = TOKEN_OPTIMIZATION.maxHistoryRounds * 2;
  const trimmedMessages = messages.length > maxMessages ? messages.slice(-maxMessages) : messages;

  chatLog.debug('Starting streaming chat request', {
    messageCount: messages.length,
    hasContext: !!gameContext,
  });

  let response: Response;
  try {
    response = await fetch(`${API_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: API_CONFIG.model,
        messages: [{ role: 'system', content: systemPrompt }, ...trimmedMessages],
        max_tokens: API_CONFIG.maxTokens,
        temperature: 0.7,
        stream: true,
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    yield { type: 'error', content: error instanceof Error ? error.message : '网络请求失败' };
    return;
  }

  if (!response.ok) {
    const errorText = await response.text();
    chatLog.error('Streaming API error', { status: response.status, error: errorText });
    if (response.status === 401) {
      yield { type: 'error', content: 'Groq API Key 无效或未配置，请联系管理员' };
    } else if (response.status === 429) {
      yield { type: 'error', content: '请求太频繁，请稍后再试' };
    } else {
      yield { type: 'error', content: `API 错误: ${response.status}` };
    }
    return;
  }

  // Parse SSE stream
  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', content: '浏览器不支持流式响应' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // SSE comment or empty
        if (!trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6); // Remove "data: " prefix
        if (data === '[DONE]') {
          yield { type: 'done', content: '' };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield { type: 'delta', content: delta };
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { type: 'done', content: '' };
}
