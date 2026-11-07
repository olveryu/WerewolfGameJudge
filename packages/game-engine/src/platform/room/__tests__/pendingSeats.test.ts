import { describe, expect, it } from 'vitest';

import { getPendingSeats } from '../pendingSeats';

describe('getPendingSeats', () => {
  it('returns every eligible seat when nothing has been submitted', () => {
    expect(getPendingSeats([0, 1, 2, 3, 4], {})).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns only the seats whose keys are missing from the submission record', () => {
    expect(getPendingSeats([0, 1, 2, 3, 4], { 0: 'approve', 2: 'reject' })).toEqual([1, 3, 4]);
  });

  it('returns an empty list when every eligible seat has submitted', () => {
    expect(getPendingSeats([0, 1, 2], { 0: 'approve', 1: 'reject', 2: 'approve' })).toEqual([]);
  });

  it('sorts the pending seats ascending even when the eligible set is unsorted', () => {
    expect(getPendingSeats([4, 1, 3, 0], { 1: 'approve' })).toEqual([0, 3, 4]);
  });

  it('ignores submissions from seats outside the eligible set', () => {
    expect(getPendingSeats([1, 2], { 0: 'approve', 1: 'reject', 9: 'approve' })).toEqual([2]);
  });

  it('reads only submission keys, never values', () => {
    // A submitted value of any shape (including null) still counts as submitted.
    expect(getPendingSeats([0, 1], { 0: null, 1: undefined })).toEqual([]);
  });
});
