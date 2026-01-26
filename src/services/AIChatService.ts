/**
 * AI Chat Service - GitHub Models (GPT-4o)
 *
 * 使用 GitHub Models 提供免费的 GPT-4o API
 * 文档: https://docs.github.com/en/github-models
 */

import { log } from '../utils/logger';
import { ROLE_SPECS } from '../models/roles/spec/specs';

const chatLog = log.extend('AIChatService');

// GitHub Models API 配置
const API_CONFIG = {
  baseURL: 'https://models.inference.ai.azure.com',
  model: 'gpt-4o',
  maxTokens: 1024,
};

// 从环境变量获取默认 API Key（用户无需手动配置）
const DEFAULT_API_KEY = process.env.EXPO_PUBLIC_GITHUB_TOKEN || '';

/**
 * 获取 API Key（优先使用环境变量）
 */
export function getDefaultApiKey(): string {
  return DEFAULT_API_KEY;
}

/**
 * 检查是否已配置 API Key
 */
export function hasApiKey(): boolean {
  return !!DEFAULT_API_KEY;
}

// 获取所有角色信息用于 System Prompt
function getRolesDescription(): string {
  const roles = Object.values(ROLE_SPECS);
  return roles
    .map((role) => `- ${role.displayName}: ${role.description}`)
    .join('\n');
}

// System Prompt - 狼人杀游戏助手
const SYSTEM_PROMPT = `你是一个专业的狼人杀游戏助手，名叫"狼人杀小助手"。你的职责是：

1. **规则解答**: 解释狼人杀游戏规则、角色技能、特殊情况处理
2. **策略建议**: 提供游戏策略、发言技巧、推理方法
3. **争议裁决**: 帮助解释规则争议，给出合理判断
4. **娱乐互动**: 友好地与玩家聊天，增加游戏乐趣

## 你了解的角色

${getRolesDescription()}

## 回答原则

- 使用简洁、口语化的中文回答
- 回答要准确，如果不确定请说明
- 可以使用 emoji 增加趣味性 🐺
- 如果问题与狼人杀无关，也可以友好地回答，但适时引导回游戏话题
- 每次回答尽量控制在 200 字以内，除非用户要求详细解释

## 特别注意

- 本 App 只处理第一晚 (Night-1)，白天发言投票在线下进行
- 守卫不能连续两晚守同一人（但本 App 只有一晚所以不受限）
- 女巫第一晚不能自救
- 机械狼与普通狼人互不相认
- 石像鬼不参与狼人投票`;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 发送聊天消息到 AI
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  apiKey: string
): Promise<ChatResponse> {
  if (!apiKey) {
    return { success: false, error: '请先配置 GitHub Token' };
  }

  try {
    chatLog.debug('Sending chat request', { messageCount: messages.length });

    const response = await fetch(`${API_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: API_CONFIG.model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_tokens: API_CONFIG.maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      chatLog.error('API error', { status: response.status, error: errorText });

      if (response.status === 401) {
        return { success: false, error: 'GitHub Token 无效，请检查配置' };
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
    chatLog.error('Chat request failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
    };
  }
}

/**
 * 测试 API Key 是否有效
 */
export async function testApiKey(apiKey: string): Promise<boolean> {
  const response = await sendChatMessage([{ role: 'user', content: '你好' }], apiKey);
  return response.success;
}
