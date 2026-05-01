/**
 * AI Chat Service — Workers AI (primary) + Gemini (fallback) via Cloudflare Workers
 *
 * 服务端使用 Workers AI (@cf/google/gemma-3-12b-it) 为主力，Neurons 超限时 fallback Gemini。
 * 客户端只负责消息组织、流式解析 SSE 响应。模型选择在服务端。
 * 不直接访问第三方 API，不存储 API key，不操作游戏状态。
 */

import * as Sentry from '@sentry/react-native';
import { type GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';

import { API_BASE_URL } from '@/config/api';
import { NETWORK_ERROR } from '@/config/errorMessages';
import { getCurrentToken } from '@/services/cloudflare/cfFetch';
import { log } from '@/utils/logger';

const chatLog = log.extend('AIChatService');

const API_CONFIG = {
  /** Workers AI chat endpoint */
  baseURL: `${API_BASE_URL}/gemini-proxy`,
  maxTokens: 2048,
};

// Token 优化配置
const TOKEN_OPTIMIZATION = {
  maxHistoryRounds: 3, // 最多保留最近 3 轮对话
};

/**
 * 检查 AI 服务是否就绪
 */
export function isAIChatReady(): boolean {
  return true;
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
  status?: GameStatus;
  /** 我的座位号 */
  mySeat?: number;
  /** 我的角色 */
  myRole?: string;
  /** 我的角色名称 */
  myRoleName?: string;
  /** 总人数 */
  totalPlayers?: number;
  /** 本局每个角色的详细技能描述（公开信息） */
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
      Unseated: '等待入座',
      Seated: '已入座，等待分配角色',
      Assigned: '已分配角色，等待查看',
      Ready: '已准备，等待开始',
      Ongoing: '游戏进行中（第一夜）',
      Ended: '游戏已结束',
    };
    lines.push(`- 游戏状态: ${statusMap[context.status] || context.status}`);
  }

  if (context.mySeat !== undefined) {
    lines.push(`- 我的座位: ${formatSeat(context.mySeat)}`);
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
    lines.push(`- 角色配置: ${[...uniqueRoles.keys()].join('、')}`);
    lines.push(`- 本局角色技能:`);
    uniqueRoles.forEach((desc, name) => {
      lines.push(`  - ${name}: ${desc}`);
    });
  }

  lines.push('');

  return lines.join('\n');
}

// 优化1: 移除 getRolesDescription，改用角色配置上下文中的角色

// 优化3+4: 精简 System Prompt，移除跟进问题要求
const SYSTEM_PROMPT = `你是狼人杀游戏助手。职责：规则解答、策略建议、争议裁决。

回答原则：
- 简洁中文，默认简短回答；当用户提交笔记分析等长任务时按其要求的篇幅输出
- 适当使用 **加粗** 突出关键词、- 列表分条说明、emoji 🐺 增加可读性
- 本App只处理第一夜，白天在线下进行`;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ══════════════════════════════════════════════════════════
// Streaming (SSE)
// ══════════════════════════════════════════════════════════

interface StreamChunk {
  type: 'delta' | 'done' | 'error';
  content: string;
}

/**
 * 流式发送聊天消息到 AI（SSE，通过 Workers 代理）
 *
 * 使用 Cloudflare Workers 代理 Gemini streaming endpoint，逐 token 返回。
 * 调用者用 `for await (const chunk of streamChatMessage(...))` 消费。
 *
 * @param messages 聊天消息历史
 * @param gameContext 可选的游戏上下文
 * @param signal 可选的 AbortSignal
 */
export async function* streamChatMessage(
  messages: ChatMessage[],
  gameContext?: GameContext,
  signal?: AbortSignal,
  maxTokens?: number,
): AsyncGenerator<StreamChunk> {
  if (!isAIChatReady()) {
    yield { type: 'error', content: 'AI 服务未配置' };
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getCurrentToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Combine caller abort signal with a 30s TTFB timeout so long inputs don't hang forever
  const timeoutSignal = AbortSignal.timeout(30_000);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  let response: Response;
  try {
    response = await fetch(API_CONFIG.baseURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [{ role: 'system', content: systemPrompt }, ...trimmedMessages],
        max_tokens: maxTokens ?? API_CONFIG.maxTokens,
        temperature: 0.7,
        stream: true,
      }),
      signal: combinedSignal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    if (error instanceof Error && error.name === 'TimeoutError') {
      chatLog.warn('Streaming fetch timed out (30s TTFB)');
      yield { type: 'error', content: 'AI 响应超时，请稍后重试' };
      return;
    }
    chatLog.warn('Streaming fetch failed (network)', error);
    yield { type: 'error', content: NETWORK_ERROR };
    return;
  }

  if (!response.ok) {
    const errorText = await response.text();

    // Parse structured error code from server
    let errorCode: string | undefined;
    try {
      const parsed: unknown = JSON.parse(errorText);
      if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
        const { error } = parsed as { error: unknown };
        if (typeof error === 'string') errorCode = error;
      }
    } catch {
      // Not JSON — use raw text for logging
    }

    if (response.status === 401) {
      chatLog.warn('AI service auth failed', { status: response.status, error: errorText });
      yield { type: 'error', content: 'AI 服务认证失败，请联系管理员' };
    } else if (response.status === 429 || errorCode === 'quota_exhausted') {
      chatLog.warn('AI quota exhausted', { status: response.status, errorCode });
      yield { type: 'error', content: '今日 AI 使用次数已达上限，明天再试吧' };
    } else if (response.status === 502 || response.status === 503) {
      chatLog.warn('Upstream unavailable', { status: response.status, error: errorText });
      yield { type: 'error', content: 'AI 服务暂时不可用，请稍后重试' };
    } else {
      chatLog.error('Streaming API error', { status: response.status, error: errorText });
      Sentry.captureException(new Error(`Streaming API error: HTTP ${response.status}`));
      yield { type: 'error', content: 'AI 服务暂时不可用，请稍后重试' };
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
          const parsed: unknown = JSON.parse(data);
          const delta = extractDelta(parsed);
          if (delta) {
            yield { type: 'delta', content: delta };
          }
        } catch {
          chatLog.debug('SSE chunk parse failed, skipping', { data });
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { type: 'done', content: '' };
}

/** Extract delta content from an OpenAI-compatible SSE chunk. */
function extractDelta(parsed: unknown): string | undefined {
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.choices)) return undefined;
  const first: unknown = obj.choices[0];
  if (typeof first !== 'object' || first === null) return undefined;
  const choice = first as Record<string, unknown>;
  if (typeof choice.delta !== 'object' || choice.delta === null) return undefined;
  const delta = choice.delta as Record<string, unknown>;
  return typeof delta.content === 'string' ? delta.content : undefined;
}
