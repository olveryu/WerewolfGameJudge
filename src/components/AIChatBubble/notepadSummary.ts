/**
 * notepadSummary - 将笔记状态格式化为 AI 分析请求文本
 *
 * 纯函数，无副作用。读取 NotepadState + roleTags，
 * 输出结构化文本供 AI 分析游戏局势。
 * 不调用 service，不修改 state。
 */

import { ROLE_SPECS } from '@werewolf/game-engine/models/roles';

import type { NotepadState } from '@/hooks/useNotepad';

/** 总文本最大字符数（截断公共笔记区） */
const MAX_SUMMARY_LENGTH = 1500;

/** 记录者自身身份信息 */
export interface NotepadRoleInfo {
  seat: number;
  roleName: string;
}

/**
 * 将笔记状态构建为 AI 分析请求文本。
 * 空笔记返回 null。
 */
export function buildNotepadSummary(
  state: NotepadState,
  playerCount: number,
  myRoleInfo?: NotepadRoleInfo,
): string | null {
  const seatLines: string[] = [];
  const handSeats: number[] = [];

  for (let seat = 1; seat <= playerCount; seat++) {
    const note = state.playerNotes[seat]?.trim();
    const hand = state.handStates[seat];
    const roleGuess = state.roleGuesses[seat];

    if (hand) handSeats.push(seat);

    // Skip seats with no information at all
    if (!note && !hand && !roleGuess) continue;

    const parts: string[] = [];

    // Seat number (1-based)
    parts.push(`${seat}号位`);

    // Role guess
    if (roleGuess) {
      const spec = ROLE_SPECS[roleGuess];
      const roleName = spec?.displayName ?? roleGuess;
      parts[parts.length - 1] += `（猜测：${roleName}）`;
    }

    // Hand state
    if (hand) {
      parts[parts.length - 1] += '[上警]';
    }

    // Note text
    const label = parts.join('');
    seatLines.push(note ? `- ${label}：${note}` : `- ${label}`);
  }

  const publicLeft = state.publicNoteLeft?.trim();
  const publicRight = state.publicNoteRight?.trim();

  // Check if there's any content at all
  if (seatLines.length === 0 && !publicLeft && !publicRight) {
    return null;
  }

  // Note: 板子角色配置和技能描述已通过 system prompt (buildPlayerContext → buildGameContextPrompt) 注入，
  // 此处不重复，避免浪费 token。

  // Assemble sections
  const sections: string[] = [
    '[角色] 你是一名拥有丰富狼人杀复盘经验的专业分析师。基于玩家提供的笔记，输出严谨的局势分析。',
    '',
    ...(myRoleInfo ? [`[记录者身份] ${myRoleInfo.seat}号位 ${myRoleInfo.roleName}`, ''] : []),
    '[规则]',
    '- 逻辑优先级：收益逻辑＞发言状态＞位置学，禁止无事实支撑的玄学分析',
    '- 所有结论必须锚定笔记中记录的发言、投票、上警等可追溯行为',
    '- 从记录者自身视角分析（参考上方记录者身份），不做上帝视角马后炮',
    '- 对争议行为同时拆解正逻辑与反逻辑',
    '- 结合上方"当前游戏状态"中的角色配置和技能进行推理',
    '- 本次分析可以超过150字，控制在300字内',
    '',
    '[输出结构]',
    '1. **身份推理**：逐一分析可疑玩家最可能的身份，锚定具体行为给出依据',
    '2. **阵营判断**：好人/狼人阵营划分，关键矛盾点与逻辑链',
    '3. **行动建议**：投票优先级、保护目标、下轮重点关注',
  ];

  if (seatLines.length > 0) {
    sections.push('## 玩家笔记');
    if (handSeats.length > 0) {
      sections.push(`上警玩家：${handSeats.map((s) => `${s}号`).join('、')}`);
    }
    sections.push(...seatLines, '');
  }

  if (publicLeft || publicRight) {
    if (publicLeft) {
      sections.push('## 自由记录', publicLeft, '');
    }
    if (publicRight) {
      sections.push('## 投票记录', publicRight, '');
    }
  }

  let text = sections.filter(Boolean).join('\n');

  // Truncate if too long (trim from the end of public notes)
  if (text.length > MAX_SUMMARY_LENGTH) {
    text = text.slice(0, MAX_SUMMARY_LENGTH - 3) + '…';
  }

  return text;
}
