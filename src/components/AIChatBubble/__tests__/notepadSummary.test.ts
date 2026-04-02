/**
 * notepadSummary.test - Unit tests for buildNotepadSummary
 *
 * Verifies the pure function that formats NotepadState into
 * a structured AI analysis request text.
 */

import type { NotepadState } from '@/hooks/useNotepad';

import { buildNotepadSummary } from '../notepadSummary';

function emptyState(): NotepadState {
  return {
    playerNotes: {},
    handStates: {},
    identityStates: {},
    roleGuesses: {},
    publicNoteLeft: '',
    publicNoteRight: '',
  };
}

describe('buildNotepadSummary', () => {
  it('returns null when all notes are empty', () => {
    expect(buildNotepadSummary(emptyState(), 6)).toBeNull();
  });

  it('returns null when only empty strings in playerNotes', () => {
    const state = { ...emptyState(), playerNotes: { 1: '', 2: '  ' } };
    expect(buildNotepadSummary(state, 6)).toBeNull();
  });

  it('includes seat notes with correct seat numbers', () => {
    const state = { ...emptyState(), playerNotes: { 1: '发言很稳', 3: '有嫌疑' } };
    const result = buildNotepadSummary(state, 6);
    expect(result).not.toBeNull();
    expect(result).toContain('1号位');
    expect(result).toContain('发言很稳');
    expect(result).toContain('3号位');
    expect(result).toContain('有嫌疑');
  });

  it('shows role guess with displayName', () => {
    const state = { ...emptyState(), roleGuesses: { 2: 'wolf' as any } };
    const result = buildNotepadSummary(state, 6);
    expect(result).not.toBeNull();
    expect(result).toContain('2号位');
    expect(result).toContain('猜测：');
  });

  it('shows 上警 tag and hand summary', () => {
    const state = { ...emptyState(), handStates: { 1: true, 3: true } };
    const result = buildNotepadSummary(state, 6);
    expect(result).not.toBeNull();
    expect(result).toContain('[上警]');
    expect(result).toContain('上警玩家：1号、3号');
  });

  it('includes public notes', () => {
    const state = { ...emptyState(), publicNoteLeft: '3号被查杀' };
    const result = buildNotepadSummary(state, 6);
    expect(result).not.toBeNull();
    expect(result).toContain('## 自由记录');
    expect(result).toContain('3号被查杀');
  });

  it('includes vote records', () => {
    const state = { ...emptyState(), publicNoteRight: '第一轮：3号出局' };
    const result = buildNotepadSummary(state, 6);
    expect(result).not.toBeNull();
    expect(result).toContain('## 投票记录');
    expect(result).toContain('第一轮：3号出局');
  });

  it('includes professional analysis prompt', () => {
    const state = { ...emptyState(), playerNotes: { 1: '测试' } };
    const result = buildNotepadSummary(state, 6);
    expect(result).toContain('专业分析师');
    expect(result).toContain('身份推理');
    expect(result).toContain('行动建议');
    expect(result).toContain('逻辑优先级');
  });

  it('truncates text exceeding max length', () => {
    const longNote = '这是一个很长的笔记'.repeat(200);
    const state = { ...emptyState(), publicNoteLeft: longNote };
    const result = buildNotepadSummary(state, 6);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(1500);
    expect(result).toMatch(/…$/);
  });

  it('skips seats with no information', () => {
    const state = { ...emptyState(), playerNotes: { 3: '有内容' } };
    const result = buildNotepadSummary(state, 6);
    expect(result).not.toBeNull();
    expect(result).not.toContain('1号位');
    expect(result).not.toContain('2号位');
    expect(result).toContain('3号位');
    expect(result).toContain('有内容');
  });

  it('combines role guess, hand state, and note on same seat', () => {
    const state: NotepadState = {
      ...emptyState(),
      playerNotes: { 1: '逻辑清晰' },
      handStates: { 1: true },
      roleGuesses: { 1: 'seer' as any },
    };
    const result = buildNotepadSummary(state, 6);
    expect(result).not.toBeNull();
    expect(result).toMatch(/1号位.*猜测：.*\[上警\].*逻辑清晰/);
  });

  it('returns non-null for seat with only role guess (no note text)', () => {
    const state = { ...emptyState(), roleGuesses: { 3: 'wolf' as any } };
    const result = buildNotepadSummary(state, 6);
    expect(result).not.toBeNull();
    expect(result).toContain('3号位');
  });

  it('does not duplicate board info (already in system prompt)', () => {
    const state = { ...emptyState(), playerNotes: { 1: '测试' } };
    const result = buildNotepadSummary(state, 6);
    expect(result).not.toBeNull();
    // Board role config is injected via system prompt, not duplicated here
    expect(result).not.toContain('本局角色配置');
    expect(result).toContain('结合上方');
  });
});
