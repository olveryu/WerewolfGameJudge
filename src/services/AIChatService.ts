/**
 * AI Chat Service - Google Gemini 2.0 Flash
 *
 * 使用 Google AI Studio 提供免费的 Gemini API
 * 免费额度：15 RPM, 1500 RPD, 100万 TPM
 * 文档: https://ai.google.dev/gemini-api/docs
 */

import { log } from '../utils/logger';
import { ROLE_SPECS } from '../models/roles/spec/specs';

const chatLog = log.extend('AIChatService');

// Gemini API 配置
const API_CONFIG = {
  baseURL: 'https://generativelanguage.googleapis.com/v1beta',
  model: 'gemini-2.0-flash',
  maxTokens: 1024,
};

// 从环境变量获取默认 API Key（用户无需手动配置）
const DEFAULT_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

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
  /** 当前阶段 */
  currentPhase?: string;
  /** 已使用的技能（女巫等） */
  usedSkills?: string[];
  /** 我知道的信息（预言家查验结果等，仅自己能看到的） */
  myKnowledge?: string[];
  /** 板子配置（所有角色名称，公开信息） */
  boardRoles?: string[];
  /** 板子中每个角色的详细技能描述（公开信息） */
  boardRoleDetails?: Array<{ name: string; description: string }>;
}

/**
 * 构建游戏上下文提示（玩家视角，不泄露其他玩家信息）
 */
export function buildGameContextPrompt(context: GameContext): string {
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

  if (context.boardRoles && context.boardRoles.length > 0) {
    lines.push(`- 板子配置: ${context.boardRoles.join('、')}`);
  }

  // 显示板子中每个角色的技能（去重）
  if (context.boardRoleDetails && context.boardRoleDetails.length > 0) {
    // 去重（同一角色可能出现多次）
    const uniqueRoles = new Map<string, string>();
    context.boardRoleDetails.forEach((r) => {
      if (!uniqueRoles.has(r.name)) {
        uniqueRoles.set(r.name, r.description);
      }
    });
    lines.push(`- 本局角色技能:`);
    uniqueRoles.forEach((desc, name) => {
      lines.push(`  - ${name}: ${desc}`);
    });
  }

  if (context.currentPhase) {
    lines.push(`- 当前阶段: ${context.currentPhase}`);
  }

  if (context.usedSkills && context.usedSkills.length > 0) {
    lines.push(`- 已使用技能: ${context.usedSkills.join('、')}`);
  }

  if (context.myKnowledge && context.myKnowledge.length > 0) {
    lines.push(`- 我知道的信息:`);
    context.myKnowledge.forEach((k) => lines.push(`  - ${k}`));
  }

  // NOTE: deadPlayers 已移除 - 只有 Host 能宣布死亡信息

  lines.push('', '注意：以上是玩家自己能看到的信息，请基于这些信息给出建议。');

  return lines.join('\n');
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

## 跟进问题（重要！）

在每次回答的**最后**，请附带 2 个相关的跟进问题，格式必须严格如下：
\`\`\`suggestions
继续追问的问题一
继续追问的问题二
\`\`\`

跟进问题的要求：
- 每行一个问题，不要加序号、不要加符号（如 - 或 1.）
- 问题简短精炼（8-15个字，不超过15字）
- 必须以问号结尾
- 与当前对话主题直接相关
- 是用户可能真正感兴趣的内容

正确示例（用户问"女巫第一晚要救人吗"）：
\`\`\`suggestions
不救人有什么好处？
女巫能自救吗？
\`\`\`

错误示例（不要这样）：
\`\`\`suggestions
1. 不救人有什么好处？
- 女巫能自救吗？
\`\`\`

## 特别注意

- 本 App 只处理第一晚 (Night-1)，白天发言投票在线下进行
- 守卫不能连续两晚守同一人（但本 App 只有一晚所以不受限）
- 具体规则以本局游戏配置为准，请参考上下文中的角色技能描述`;

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
 * @param messages 聊天消息历史
 * @param apiKey API Key
 * @param gameContext 可选的游戏上下文（玩家视角）
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  apiKey: string,
  gameContext?: GameContext
): Promise<ChatResponse> {
  if (!apiKey) {
    return { success: false, error: '请先配置 Gemini API Key' };
  }

  try {
    chatLog.debug('Sending chat request', { messageCount: messages.length, hasContext: !!gameContext });

    // 构建系统提示（包含游戏上下文）
    let systemPrompt = SYSTEM_PROMPT;
    if (gameContext) {
      systemPrompt += '\n\n' + buildGameContextPrompt(gameContext);
    }

    // Gemini API 格式
    const geminiMessages = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `${API_CONFIG.baseURL}/models/${API_CONFIG.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: geminiMessages,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            maxOutputTokens: API_CONFIG.maxTokens,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      chatLog.error('API error', { status: response.status, error: errorText });

      if (response.status === 401 || response.status === 403) {
        return { success: false, error: 'Gemini API Key 无效或未配置，请联系管理员' };
      }
      if (response.status === 429) {
        return { success: false, error: '请求太频繁，请稍后再试' };
      }
      return { success: false, error: `API 错误: ${response.status}` };
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

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
