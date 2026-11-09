import { resolveSeatPickTap } from '../seatPicking';

describe('resolveSeatPickTap — toggle', () => {
  const base = {
    eligibleSeats: [0, 1, 2, 3, 4],
    mode: 'toggle' as const,
    maxSize: 2,
    ineligibleTap: 'fallthrough' as const,
  };

  it('adds an eligible seat while below the cap', () => {
    expect(resolveSeatPickTap({ ...base, seat: 3, selection: [1] })).toEqual({
      kind: 'consumed',
      nextSelection: [1, 3],
    });
  });

  it('removes an already-selected seat (tap again to cancel)', () => {
    expect(resolveSeatPickTap({ ...base, seat: 1, selection: [1, 3] })).toEqual({
      kind: 'consumed',
      nextSelection: [3],
    });
  });

  it('silently ignores an unselected seat when the selection is full', () => {
    expect(resolveSeatPickTap({ ...base, seat: 4, selection: [1, 3] })).toEqual({
      kind: 'ignored',
    });
  });

  it('still allows cancelling a selected seat when the selection is full', () => {
    expect(resolveSeatPickTap({ ...base, seat: 3, selection: [1, 3] })).toEqual({
      kind: 'consumed',
      nextSelection: [1],
    });
  });

  it('falls through on an ineligible seat when ineligibleTap is fallthrough', () => {
    expect(resolveSeatPickTap({ ...base, seat: 9, selection: [] })).toEqual({
      kind: 'fallthrough',
    });
  });

  it('swallows an ineligible seat when ineligibleTap is swallow', () => {
    expect(
      resolveSeatPickTap({ ...base, seat: 9, selection: [], ineligibleTap: 'swallow' }),
    ).toEqual({ kind: 'ignored' });
  });

  it('without a cap, keeps adding eligible seats', () => {
    const { maxSize: _cap, ...noCap } = base;
    expect(resolveSeatPickTap({ ...noCap, seat: 4, selection: [0, 1, 2, 3] })).toEqual({
      kind: 'consumed',
      nextSelection: [0, 1, 2, 3, 4],
    });
  });
});

describe('resolveSeatPickTap — replace', () => {
  const base = {
    eligibleSeats: [0, 1, 2],
    mode: 'replace' as const,
    ineligibleTap: 'swallow' as const,
  };

  it('replaces the previous selection with the tapped seat', () => {
    expect(resolveSeatPickTap({ ...base, seat: 2, selection: [0] })).toEqual({
      kind: 'consumed',
      nextSelection: [2],
    });
  });

  it('keeps the seat when the same seat is tapped again', () => {
    expect(resolveSeatPickTap({ ...base, seat: 2, selection: [2] })).toEqual({
      kind: 'consumed',
      nextSelection: [2],
    });
  });

  it('swallows a tap on an already-revealed (ineligible) seat', () => {
    expect(resolveSeatPickTap({ ...base, seat: 5, selection: [2] })).toEqual({ kind: 'ignored' });
  });
});

describe('resolveSeatPickTap — trigger', () => {
  const base = {
    eligibleSeats: [1, 3],
    mode: 'trigger' as const,
    selection: [] as readonly number[],
    ineligibleTap: 'fallthrough' as const,
  };

  it('picks an eligible seat without touching any selection', () => {
    expect(resolveSeatPickTap({ ...base, seat: 3 })).toEqual({ kind: 'pick', seat: 3 });
  });

  it('falls through on an ineligible seat', () => {
    expect(resolveSeatPickTap({ ...base, seat: 2 })).toEqual({ kind: 'fallthrough' });
  });

  it('swallows an ineligible seat in swallow mode (fibking guessing)', () => {
    expect(resolveSeatPickTap({ ...base, seat: 2, ineligibleTap: 'swallow' })).toEqual({
      kind: 'ignored',
    });
  });
});
