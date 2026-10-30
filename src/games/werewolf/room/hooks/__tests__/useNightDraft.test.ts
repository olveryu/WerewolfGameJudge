/**
 * useNightDraft: the stored shape is validated against the seat count and
 * the draft is discarded when its scope (step, actor, round) changes.
 */
import { act, renderHook } from '@testing-library/react-native';

import {
  EMPTY_NIGHT_DRAFT,
  type NightDraftScope,
  parseNightDraft,
  useNightDraft,
} from '../useNightDraft';

describe('parseNightDraft', () => {
  it('accepts a well-formed draft within the seat count', () => {
    expect(parseNightDraft({ firstSwapSeat: 3, multiSelectedSeats: [0, 5] }, 6)).toEqual({
      firstSwapSeat: 3,
      multiSelectedSeats: [0, 5],
    });
    expect(parseNightDraft(EMPTY_NIGHT_DRAFT, 6)).toEqual(EMPTY_NIGHT_DRAFT);
  });

  it('rejects out-of-range seats and malformed shapes', () => {
    expect(() => parseNightDraft({ firstSwapSeat: 6, multiSelectedSeats: [] }, 6)).toThrow(
      'out of range',
    );
    expect(() => parseNightDraft({ firstSwapSeat: null, multiSelectedSeats: [-1] }, 6)).toThrow(
      'seats in range',
    );
    expect(() => parseNightDraft('draft', 6)).toThrow('must be an object');
  });
});

describe('useNightDraft', () => {
  const scope: NightDraftScope = {
    stepId: 'magicianSwap',
    actorSeat: 2,
    roleRevealRandomNonce: 'r1',
    seatCount: 6,
  };

  it('keeps the draft within one step scope and resets on a scope change', () => {
    const { result, rerender } = renderHook(
      (props: { scope: NightDraftScope }) =>
        useNightDraft({ userId: 'u', roomId: 'room', scope: props.scope }),
      { initialProps: { scope } },
    );
    act(() => {
      result.current.updateDraft((current) => ({ ...current, firstSwapSeat: 4 }));
    });
    expect(result.current.draft.firstSwapSeat).toBe(4);

    rerender({ scope: { ...scope, stepId: 'seerCheck' } });
    expect(result.current.draft).toEqual(EMPTY_NIGHT_DRAFT);
  });
});
