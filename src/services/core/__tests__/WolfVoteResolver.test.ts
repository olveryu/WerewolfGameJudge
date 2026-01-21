/**
 * WolfVoteResolver Tests
 *
 * Step 8: Test cases for wolf voting resolution logic
 */

import { resolveWolfVotes } from '../WolfVoteResolver';

describe('WolfVoteResolver', () => {
  describe('resolveWolfVotes', () => {
    describe('Unanimous votes', () => {
      it('should return target when all wolves vote for same player', () => {
        const votes = new Map<number, number>([
          [1, 5],
          [2, 5],
          [3, 5],
        ]);
        expect(resolveWolfVotes(votes)).toBe(5);
      });

      it('should return target when single wolf votes', () => {
        const votes = new Map<number, number>([[1, 3]]);
        expect(resolveWolfVotes(votes)).toBe(3);
      });
    });

    describe('Majority votes', () => {
      it('should return target with most votes (2 vs 1)', () => {
        const votes = new Map<number, number>([
          [1, 5],
          [2, 5],
          [3, 7],
        ]);
        expect(resolveWolfVotes(votes)).toBe(5);
      });

      it('should return target with most votes (3 vs 1 vs 1)', () => {
        const votes = new Map<number, number>([
          [1, 5],
          [2, 5],
          [3, 5],
          [4, 7],
          [5, 8],
        ]);
        expect(resolveWolfVotes(votes)).toBe(5);
      });

      it('should return majority winner when some abstain', () => {
        const votes = new Map<number, number>([
          [1, 5],
          [2, 5],
          [3, -1], // abstain
        ]);
        expect(resolveWolfVotes(votes)).toBe(5);
      });
    });

    describe('Tie votes (空刀)', () => {
      it('should return null when two targets have equal votes', () => {
        const votes = new Map<number, number>([
          [1, 5],
          [2, 7],
        ]);
        expect(resolveWolfVotes(votes)).toBeNull();
      });

      it('should return null when three targets have equal votes', () => {
        const votes = new Map<number, number>([
          [1, 5],
          [2, 7],
          [3, 8],
        ]);
        expect(resolveWolfVotes(votes)).toBeNull();
      });

      it('should return null when two-way tie with higher counts', () => {
        const votes = new Map<number, number>([
          [1, 5],
          [2, 5],
          [3, 7],
          [4, 7],
        ]);
        expect(resolveWolfVotes(votes)).toBeNull();
      });
    });

    describe('All abstain (空刀)', () => {
      it('should return null when all wolves abstain', () => {
        const votes = new Map<number, number>([
          [1, -1],
          [2, -1],
          [3, -1],
        ]);
        expect(resolveWolfVotes(votes)).toBeNull();
      });

      it('should return null when single wolf abstains', () => {
        const votes = new Map<number, number>([[1, -1]]);
        expect(resolveWolfVotes(votes)).toBeNull();
      });
    });

    describe('Empty votes', () => {
      it('should return null when no votes provided', () => {
        const votes = new Map<number, number>();
        expect(resolveWolfVotes(votes)).toBeNull();
      });
    });

    describe('Edge cases', () => {
      it('should handle single valid vote among abstentions', () => {
        const votes = new Map<number, number>([
          [1, -1],
          [2, 5],
          [3, -1],
        ]);
        expect(resolveWolfVotes(votes)).toBe(5);
      });

      it('should handle tie after filtering abstentions', () => {
        const votes = new Map<number, number>([
          [1, 5],
          [2, 7],
          [3, -1],
          [4, -1],
        ]);
        expect(resolveWolfVotes(votes)).toBeNull();
      });

      it('should correctly count votes for seat 0', () => {
        const votes = new Map<number, number>([
          [1, 0],
          [2, 0],
        ]);
        expect(resolveWolfVotes(votes)).toBe(0);
      });
    });
  });
});
