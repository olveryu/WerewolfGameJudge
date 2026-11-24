/**
 * The summary bar's phase context: the ended phase keeps its 「本局结束」
 * context so the bar reads 「本局结束 · 好人/坏人获胜」. States come from the real engine.
 */
import { buildAvalonTestState, playAvalonTestGame } from '@/test-utils/avalonState';

import { createAvalonCurrentStatus } from '../avalonRoomAdapter';
import { createAvalonStatusContext } from '../avalonStatusContext';

describe('createAvalonStatusContext', () => {
  it('has no context before the day starts', () => {
    expect(createAvalonStatusContext(buildAvalonTestState())).toBeNull();
  });

  it('names the quest and proposal while nominating', () => {
    const running = playAvalonTestGame(2);
    expect(running.phase.kind).toBe('nominate');
    expect(createAvalonStatusContext(running)).toMatch(/^任务.+ · 第\d次提案$/);
  });

  it('keeps 本局结束 at the end, paired with the winner', () => {
    const ended = playAvalonTestGame(3);
    expect(ended.phase).toMatchObject({ kind: 'ended', winner: 'evil' });
    expect(createAvalonStatusContext(ended)).toBe('本局结束');
    expect(createAvalonCurrentStatus(ended)).toBe('坏人获胜');
  });
});
