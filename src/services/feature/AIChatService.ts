/**
 * AI Chat Service - Gemini (3.1 Flash Lite) via Cloudflare Workers
 *
 * 通过 Cloudflare Workers 代理 Gemini API（OpenAI 兼容层），API key 仅存在服务端。
 * 免费额度：250K TPM, 500 RPD, 15 RPM
 * 文档: https://ai.google.dev/gemini-api/docs/rate-limits
 *
 * 负责调用 Workers 代理、管理对话历史、流式解析 SSE 响应。
 * 不直接访问第三方 API，不存储 API key，不操作游戏状态。
 */

import * as Sentry from '@sentry/react-native';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';

import { API_BASE_URL } from '@/config/api';
import { NETWORK_ERROR, RATE_LIMIT_ERROR } from '@/config/errorMessages';
import { getCurrentToken } from '@/services/cloudflare/cfFetch';
import { log } from '@/utils/logger';

const chatLog = log.extend('AIChatService');

const API_CONFIG = {
  /** Workers endpoint（代理到 Gemini） */
  baseURL: `${API_BASE_URL}/gemini-proxy`,
  model: 'gemini-3.1-flash-lite-preview',
  maxTokens: 512,
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
- 简洁中文，控制在150字内
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

  let response: Response;
  try {
    response = await fetch(API_CONFIG.baseURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: API_CONFIG.model,
        messages: [{ role: 'system', content: systemPrompt }, ...trimmedMessages],
        max_tokens: maxTokens ?? API_CONFIG.maxTokens,
        temperature: 0.7,
        stream: true,
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    chatLog.warn('Streaming fetch failed (network)', error);
    yield { type: 'error', content: NETWORK_ERROR };
    return;
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      chatLog.warn('AI service auth failed', { status: response.status, error: errorText });
      yield { type: 'error', content: 'AI 服务认证失败，请联系管理员' };
    } else if (response.status === 429) {
      chatLog.warn('Rate limited by AI service', { status: response.status, error: errorText });
      yield { type: 'error', content: RATE_LIMIT_ERROR };
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
