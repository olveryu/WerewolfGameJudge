/**
 * notepadSummary - formats notepad state as AI analysis request text
 *
 * Pure function, no side effects. Reads WerewolfNotepadState + role tags,
 * outputs structured text for AI to analyze game situation.
 * Does not call services, does not mutate state.
 */

import { ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';

import type {
  NotepadSheriffCandidateStatus,
  NotepadSheriffCandidateStatuses,
  WerewolfNotepadState,
} from '@/games/werewolf/state/WerewolfNotepadState';

/** Max total text length (truncates public note section) */
const MAX_SUMMARY_LENGTH = 1500;

/** Recorder's own identity info */
interface NotepadRoleInfo {
  seat: number;
  roleName: string;
}

function getSheriffCandidateStatus(
  state: WerewolfNotepadState,
  sheriffCandidateStatuses: NotepadSheriffCandidateStatuses | undefined,
  seat: number,
): NotepadSheriffCandidateStatus | undefined {
  if (sheriffCandidateStatuses !== undefined) return sheriffCandidateStatuses[seat];
  return state.handStates[seat] === true ? 'registered' : undefined;
}

/**
 * Build notepad state into AI analysis request text.
 * Returns null for empty notepad.
 */
export function buildNotepadSummary(
  state: WerewolfNotepadState,
  playerCount: number,
  myRoleInfo?: NotepadRoleInfo,
  sheriffCandidateStatuses?: NotepadSheriffCandidateStatuses,
): string | null {
  const seatLines: string[] = [];
  const registeredSeats: number[] = [];
  const withdrawnSeats: number[] = [];

  for (let seat = 1; seat <= playerCount; seat++) {
    const note = state.playerNotes[seat]?.trim();
    const sheriffCandidateStatus = getSheriffCandidateStatus(state, sheriffCandidateStatuses, seat);
    const roleGuess = state.roleGuesses[seat];

    if (sheriffCandidateStatus !== undefined) registeredSeats.push(seat);
    if (sheriffCandidateStatus === 'withdrawn') withdrawnSeats.push(seat);

    // Skip seats with no information at all
    if (!note && sheriffCandidateStatus === undefined && !roleGuess) continue;

    const parts: string[] = [];

    // Seat number (1-based)
    parts.push(`${seat}号位`);

    // Role guess
    if (roleGuess) {
      const spec = ROLE_SPECS[roleGuess];
      const roleName = spec?.displayName ?? roleGuess;
      parts[parts.length - 1] += `（猜测：${roleName}）`;
    }

    // Sheriff-election status
    if (sheriffCandidateStatus === 'registered') {
      parts[parts.length - 1] += '[上警]';
    } else if (sheriffCandidateStatus === 'withdrawn') {
      parts[parts.length - 1] += '[退水]';
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

  // Note: board role config and skill descriptions are already injected via system prompt
  // (buildPlayerContext -> buildGameContextPrompt); not repeated here to avoid wasting tokens.

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
    '- 篇幅不限，根据笔记量充分展开分析',
    '',
    '[输出结构]',
    '1. **身份推理**：逐一分析可疑玩家最可能的身份，锚定具体行为给出依据',
    '2. **阵营判断**：好人/狼人阵营划分，关键矛盾点与逻辑链',
    '3. **行动建议**：投票优先级、保护目标、下轮重点关注',
  ];

  if (seatLines.length > 0) {
    sections.push('## 玩家笔记');
    if (registeredSeats.length > 0) {
      sections.push(`上警玩家：${registeredSeats.map((seat) => `${seat}号`).join('、')}`);
    }
    if (withdrawnSeats.length > 0) {
      sections.push(`退水玩家：${withdrawnSeats.map((seat) => `${seat}号`).join('、')}`);
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
