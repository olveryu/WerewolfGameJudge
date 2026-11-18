import { getSecrethitlerViewModel } from '@game-judge/game-engine/games/secrethitler/public';

import { viewerFor } from '@/test-utils/roomViewer';
import { buildSecrethitlerPhaseStates } from '@/test-utils/secrethitlerState';

import { secrethitlerReview } from '../secrethitlerReview';
import { toSecrethitlerReviewDocument } from '../toSecrethitlerReviewDocument';

const states = buildSecrethitlerPhaseStates();
const ended = states.get('ended');
if (ended === undefined || ended.phase.kind !== 'ended') throw new Error('Missing ended fixture');

describe('Secret Hitler public review', () => {
  it('reveals every identity and includes every public ballot, policy and executive action', () => {
    const document = toSecrethitlerReviewDocument({ state: ended, roomCode: '1234' });
    const blocks = document.pages[0]?.blocks;
    expect(blocks).toBeDefined();
    const roster = blocks?.find((block) => block.kind === 'roster');
    if (roster?.kind !== 'roster') throw new Error('Missing review roster');
    expect(roster.rows).toHaveLength(8);
    expect(roster.rows.some((row) => row.role === '希特勒')).toBe(true);
    expect(roster.rows.filter((row) => row.isOut)).toHaveLength(8 - ended.livingSeats.length);
    const timelines = blocks?.filter((block) => block.kind === 'timeline');
    expect(timelines?.map((block) => block.steps.length)).toEqual([
      ended.history.governments.length,
      ended.history.policies.length,
      ended.history.actions.length,
    ]);
    expect(JSON.stringify(document)).not.toContain('policyDeck');
    expect(JSON.stringify(document)).not.toContain('policyDiscard');
    expect(JSON.stringify(document)).not.toContain('lastInvestigation');
  });

  it('keeps secret election ballots private in the shareable review', () => {
    const secretEnded = {
      ...ended,
      config: { ...ended.config, voteMode: 'secret' as const },
    };
    const document = toSecrethitlerReviewDocument({
      state: secretEnded,
      roomCode: '1234',
    });
    const serialized = JSON.stringify(document);

    expect(serialized).toContain('暗投：赞成');
    expect(serialized).not.toContain('1号赞成');
    expect(serialized).not.toContain('1号反对');
  });

  it('rejects unfinished review construction and exposes no review to any viewer before the end', () => {
    for (const [phase, state] of states) {
      if (phase === 'ended') continue;
      expect(() => toSecrethitlerReviewDocument({ state, roomCode: '1234' })).toThrow(
        '[FAIL-FAST]',
      );
      for (const audience of ['host', 'seated', 'spectator'] as const) {
        expect(
          secrethitlerReview.resolve({ state, viewer: viewerFor(audience), roomCode: '1234' }),
        ).toEqual({ kind: 'notEnded' });
      }
    }
  });

  it.each(['host', 'seated', 'spectator'] as const)(
    'opens a shareable ended document for %s',
    (audience) => {
      expect(
        getSecrethitlerViewModel(ended, null).seats.every((seat) => seat.identity !== null),
      ).toBe(true);
      expect(
        secrethitlerReview.resolve({ state: ended, viewer: viewerFor(audience), roomCode: '1234' }),
      ).toMatchObject({
        kind: 'available',
        sharing: { isAllowed: true },
        confirmation: null,
        document: { roundKey: `game-${ended.gameSequence}` },
      });
    },
  );
});
