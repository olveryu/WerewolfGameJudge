/**
 * notepadSummary - 将笔记状态格式化为 AI 分析请求文本
 *
 * 纯函数，无副作用。读取 NotepadState + roleTags，
 * 输出结构化文本供 AI 分析游戏局势。
 * 不调用 service，不修改 state。
 */

import { ROLE_SPECS } from '@werewolf/game-engine/models/roles';

import type { NotepadState, RoleTagInfo } from '@/hooks/useNotepad';

/** 总文本最大字符数（截断公共笔记区） */
const MAX_SUMMARY_LENGTH = 1500;

/**
 * 将笔记状态构建为 AI 分析请求文本。
 * 空笔记返回 null。
 */
export function buildNotepadSummary(
  state: NotepadState,
  roleTags: readonly RoleTagInfo[],
  playerCount: number,
): string | null {
  const seatLines: string[] = [];

  for (let seat = 0; seat < playerCount; seat++) {
    const note = state.playerNotes[seat]?.trim();
    const hand = state.handStates[seat];
    const roleGuess = state.roleGuesses[seat];

    // Skip seats with no information at all
    if (!note && !hand && !roleGuess) continue;

    const parts: string[] = [];

    // Seat number (1-based display)
    parts.push(`${seat + 1}号位`);

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

  // Build available roles context from roleTags
  const roleListText =
    roleTags.length > 0 ? `本局角色配置：${roleTags.map((r) => r.shortName).join('、')}\n\n` : '';

  // Assemble sections
  const sections: string[] = [
    '请根据以下游戏笔记分析局势，给出角色推理和行动建议：',
    '',
    roleListText.trim(),
  ];

  if (seatLines.length > 0) {
    sections.push('## 玩家笔记', ...seatLines, '');
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
