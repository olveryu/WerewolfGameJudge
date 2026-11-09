/**
 * avalonReview: nothing to review until the game ends; then every reader
 * — host, seated player, spectator — gets the same public document,
 * shareable, with no confirmation. States come from the real engine.
 */

import type { RoomViewer } from '@/features/room/model/RoomViewer';
import { assertReviewDocument } from '@/features/room/review/assertReviewDocument';
import {
  avalonTestSeatUser,
  buildAvalonTestState,
  playAvalonTestGame,
} from '@/test-utils/avalonState';

import { avalonReview } from '../avalonReview';

const HOST: RoomViewer = { userId: avalonTestSeatUser(0), isHost: true, seat: 0 };
const SEATED: RoomViewer = { userId: avalonTestSeatUser(2), isHost: false, seat: 2 };
const SPECTATOR: RoomViewer = { userId: 'watcher', isHost: false, seat: null };
const VIEWERS = [HOST, SEATED, SPECTATOR] as const;

describe('avalonReview', () => {
  it('has nothing to review before the game ends', () => {
    expect(
      avalonReview.resolve({ state: buildAvalonTestState(), viewer: HOST, roomCode: 'ABCD' }),
    ).toEqual({ kind: 'notEnded' });
    const running = playAvalonTestGame(2);
    expect(running.phase.kind).toBe('nominate');
    for (const viewer of VIEWERS) {
      expect(avalonReview.resolve({ state: running, viewer, roomCode: 'ABCD' })).toEqual({
        kind: 'notEnded',
      });
    }
  });

  it('gives every reader the same shareable review of the ended game, unconfirmed', () => {
    const ended = playAvalonTestGame(3);
    expect(ended.phase).toMatchObject({ kind: 'ended', winner: 'evil', reason: 'threeFail' });

    const [first, ...others] = VIEWERS.map((viewer) =>
      avalonReview.resolve({ state: ended, viewer, roomCode: 'ABCD' }),
    );
    if (first?.kind !== 'available') throw new Error('expected an available review');
    for (const other of others) expect(other).toEqual(first);
    expect(first.sharing).toEqual({ isAllowed: true });
    expect(first.confirmation).toBeNull();

    const { document } = first;
    expect(() => assertReviewDocument(document)).not.toThrow();
    // The room's first game: the engine counted the deal to 1.
    expect(document).toMatchObject({
      roundKey: 'game-1',
      kicker: '🏰 第 1 局 · 终局',
      fileStem: 'avalon-ABCD-1',
    });
    const blocks = document.pages[0]?.blocks ?? [];
    expect(blocks[0]).toMatchObject({
      kind: 'hero',
      headline: [{ kind: 'text', text: '坏人获胜' }],
      tone: 'evil',
      byline: '三个任务失败',
    });
    expect(blocks[1]).toEqual({
      kind: 'stats',
      items: [
        { label: '成功', value: '0' },
        { label: '失败', value: '3' },
        { label: '否决', value: '0' },
      ],
    });
    const roster = blocks.find((block) => block.kind === 'roster');
    if (roster?.kind !== 'roster') throw new Error('expected the identity roster');
    expect(roster.rows.map((row) => row.name)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4']);
    const groups = blocks.find((block) => block.kind === 'groups');
    if (groups?.kind !== 'groups') throw new Error('expected the quest groups');
    expect(groups.groups.map((group) => [group.title, group.tag])).toEqual([
      ['任务一', { text: '失败 ×1', tone: 'evil' }],
      ['任务二', { text: '失败 ×1', tone: 'evil' }],
      ['任务三', { text: '失败 ×1', tone: 'evil' }],
    ]);
  });
});
