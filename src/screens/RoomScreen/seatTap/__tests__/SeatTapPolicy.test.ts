/**
 * SeatTapPolicy.test.ts - Unit tests for seat tap policy
 *
 * These tests lock the priority order contract:
 * 1. Audio Gate (highest) - NOOP when audio is playing
 * 2. DisabledReason - ALERT when seat has constraint violation
 * 3. Room Status - Route to SEATING_FLOW or ACTION_FLOW
 */

import { getSeatTapResult, SeatTapPolicyInput } from '../SeatTapPolicy';
// Use the re-export from models/Room for consistency
import { GameStatus } from '../../../../models/Room';

describe('SeatTapPolicy', () => {
  // ==========================================================================
  // Priority 1: Audio Gate (highest priority)
  // ==========================================================================
  describe('Priority 1: Audio Gate (highest priority)', () => {
    it('returns NOOP(audio_playing) when audio is playing during ongoing game', () => {
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.ongoing,
        isAudioPlaying: true,
        seatIndex: 0,
        disabledReason: undefined,
        imActioner: true,
        hasGameState: true,
      };

      const result = getSeatTapResult(input);

      expect(result.kind).toBe('NOOP');
      if (result.kind === 'NOOP') {
        expect(result.reason).toBe('audio_playing');
      }
    });

    it('audio gate takes priority over disabledReason (contract: no ALERT during audio)', () => {
      // This is the key contract test: even if disabledReason exists,
      // audio gate should still return NOOP, not ALERT
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.ongoing,
        isAudioPlaying: true,
        seatIndex: 0,
        disabledReason: '不能选择自己', // Would normally trigger ALERT
        imActioner: true,
        hasGameState: true,
      };

      const result = getSeatTapResult(input);

      expect(result.kind).toBe('NOOP');
      if (result.kind === 'NOOP') {
        expect(result.reason).toBe('audio_playing');
      }
      // Must NOT be ALERT
      expect(result.kind).not.toBe('ALERT');
    });

    it('audio gate does not apply to seating phase', () => {
      // Audio gate only applies during ongoing game
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.seated,
        isAudioPlaying: true, // Even if true, should not block seating
        seatIndex: 0,
        disabledReason: undefined,
        imActioner: false,
        hasGameState: true,
      };

      const result = getSeatTapResult(input);

      expect(result.kind).toBe('SEATING_FLOW');
    });
  });

  // ==========================================================================
  // Priority 2: DisabledReason (schema constraint violation)
  // ==========================================================================
  describe('Priority 2: DisabledReason', () => {
    it('returns ALERT when disabledReason exists (audio not playing)', () => {
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.ongoing,
        isAudioPlaying: false,
        seatIndex: 0,
        disabledReason: '不能选择自己',
        imActioner: true,
        hasGameState: true,
      };

      const result = getSeatTapResult(input);

      expect(result.kind).toBe('ALERT');
      if (result.kind === 'ALERT') {
        expect(result.title).toBe('不可选择');
        expect(result.message).toBe('不能选择自己');
      }
    });

    it('disabledReason also works during seating phase', () => {
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.seated,
        isAudioPlaying: false,
        seatIndex: 0,
        disabledReason: '某个原因',
        imActioner: false,
        hasGameState: true,
      };

      const result = getSeatTapResult(input);

      expect(result.kind).toBe('ALERT');
      if (result.kind === 'ALERT') {
        expect(result.message).toBe('某个原因');
      }
    });
  });

  // ==========================================================================
  // Priority 3: Room Status routing
  // ==========================================================================
  describe('Priority 3: Room Status routing', () => {
    describe('Seating phase', () => {
      it('returns SEATING_FLOW for unseated status', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.unseated,
          isAudioPlaying: false,
          seatIndex: 3,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('SEATING_FLOW');
        if (result.kind === 'SEATING_FLOW') {
          expect(result.seatIndex).toBe(3);
        }
      });

      it('returns SEATING_FLOW for seated status', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.seated,
          isAudioPlaying: false,
          seatIndex: 5,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('SEATING_FLOW');
        if (result.kind === 'SEATING_FLOW') {
          expect(result.seatIndex).toBe(5);
        }
      });
    });

    describe('Ongoing phase', () => {
      it('returns ACTION_FLOW when imActioner is true', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.ongoing,
          isAudioPlaying: false,
          seatIndex: 2,
          disabledReason: undefined,
          imActioner: true,
          hasGameState: true,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('ACTION_FLOW');
        if (result.kind === 'ACTION_FLOW') {
          expect(result.seatIndex).toBe(2);
        }
      });

      it('returns NOOP(not_actioner) when imActioner is false', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.ongoing,
          isAudioPlaying: false,
          seatIndex: 2,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('NOOP');
        if (result.kind === 'NOOP') {
          expect(result.reason).toBe('not_actioner');
        }
      });
    });

    describe('Other statuses', () => {
      it('returns NOOP(other_status) for assigned status', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.assigned,
          isAudioPlaying: false,
          seatIndex: 0,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('NOOP');
        if (result.kind === 'NOOP') {
          expect(result.reason).toBe('other_status');
        }
      });

      it('returns NOOP(other_status) for ready status', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.ready,
          isAudioPlaying: false,
          seatIndex: 0,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('NOOP');
        if (result.kind === 'NOOP') {
          expect(result.reason).toBe('other_status');
        }
      });

      it('returns NOOP(other_status) for ended status', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.ended,
          isAudioPlaying: false,
          seatIndex: 0,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('NOOP');
        if (result.kind === 'NOOP') {
          expect(result.reason).toBe('other_status');
        }
      });
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================
  describe('Edge cases', () => {
    it('returns NOOP(no_game_state) when hasGameState is false', () => {
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.ongoing,
        isAudioPlaying: false,
        seatIndex: 0,
        disabledReason: undefined,
        imActioner: true,
        hasGameState: false,
      };

      const result = getSeatTapResult(input);

      expect(result.kind).toBe('NOOP');
      if (result.kind === 'NOOP') {
        expect(result.reason).toBe('no_game_state');
      }
    });

    it('returns NOOP(no_game_state) when roomStatus is undefined', () => {
      const input: SeatTapPolicyInput = {
        roomStatus: undefined,
        isAudioPlaying: false,
        seatIndex: 0,
        disabledReason: undefined,
        imActioner: true,
        hasGameState: false, // No game state means undefined status
      };

      const result = getSeatTapResult(input);

      expect(result.kind).toBe('NOOP');
    });
  });
});
