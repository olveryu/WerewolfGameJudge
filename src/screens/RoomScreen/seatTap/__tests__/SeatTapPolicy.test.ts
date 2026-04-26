/**
 * SeatTapPolicy.test.ts - Unit tests for seat tap policy
 *
 * These tests lock the priority order contract:
 * 1. Audio Gate (highest) - NOOP when audio is playing
 * 2. DisabledReason - ALERT when seat has constraint violation
 * 3. Room Status - Route to SEATING_FLOW or ACTION_FLOW
 */

// Use the re-export from models/Room for consistency
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';

import { getSeatTapResult, SeatTapPolicyInput } from '@/screens/RoomScreen/seatTap/SeatTapPolicy';

describe('SeatTapPolicy', () => {
  // ==========================================================================
  // Priority 1: Audio Gate (highest priority)
  // ==========================================================================
  describe('Priority 1: Audio Gate (highest priority)', () => {
    it('returns NOOP(audio_playing) when audio is playing during ongoing game', () => {
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.Ongoing,
        isAudioPlaying: true,
        seat: 0,
        disabledReason: undefined,
        imActioner: true,
        hasGameState: true,
        isSeatOccupiedByOther: false,
        isSelfSeated: false,
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
        roomStatus: GameStatus.Ongoing,
        isAudioPlaying: true,
        seat: 0,
        disabledReason: '不能选择自己', // Would normally trigger ALERT
        imActioner: true,
        hasGameState: true,
        isSeatOccupiedByOther: false,
        isSelfSeated: false,
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
        roomStatus: GameStatus.Seated,
        isAudioPlaying: true, // Even if true, should not block seating
        seat: 0,
        disabledReason: undefined,
        imActioner: false,
        hasGameState: true,
        isSeatOccupiedByOther: false,
        isSelfSeated: false,
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
        roomStatus: GameStatus.Ongoing,
        isAudioPlaying: false,
        seat: 0,
        disabledReason: '不能选择自己',
        imActioner: true,
        hasGameState: true,
        isSeatOccupiedByOther: false,
        isSelfSeated: false,
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
        roomStatus: GameStatus.Seated,
        isAudioPlaying: false,
        seat: 0,
        disabledReason: '某个原因',
        imActioner: false,
        hasGameState: true,
        isSeatOccupiedByOther: false,
        isSelfSeated: false,
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
          roomStatus: GameStatus.Unseated,
          isAudioPlaying: false,
          seat: 3,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
          isSeatOccupiedByOther: false,
          isSelfSeated: false,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('SEATING_FLOW');
        if (result.kind === 'SEATING_FLOW') {
          expect(result.seat).toBe(3);
        }
      });

      it('returns SEATING_FLOW for seated status', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.Seated,
          isAudioPlaying: false,
          seat: 5,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
          isSeatOccupiedByOther: false,
          isSelfSeated: false,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('SEATING_FLOW');
        if (result.kind === 'SEATING_FLOW') {
          expect(result.seat).toBe(5);
        }
      });

      it('returns VIEW_PROFILE when host taps occupied seat in unseated phase', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.Unseated,
          isAudioPlaying: false,
          seat: 2,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
          isSeatOccupiedByOther: true,
          isSelfSeated: false,
          targetUserId: 'user-abc',
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('VIEW_PROFILE');
        if (result.kind === 'VIEW_PROFILE') {
          expect(result.seat).toBe(2);
          expect(result.targetUserId).toBe('user-abc');
        }
      });

      it('returns VIEW_PROFILE when host taps occupied seat in seated phase', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.Seated,
          isAudioPlaying: false,
          seat: 3,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
          isSeatOccupiedByOther: true,
          isSelfSeated: false,
          targetUserId: 'user-def',
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('VIEW_PROFILE');
        if (result.kind === 'VIEW_PROFILE') {
          expect(result.seat).toBe(3);
          expect(result.targetUserId).toBe('user-def');
        }
      });

      it('returns VIEW_PROFILE when non-host taps occupied seat', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.Seated,
          isAudioPlaying: false,
          seat: 1,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
          isSeatOccupiedByOther: true,
          isSelfSeated: false,
          targetUserId: 'user-ghi',
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('VIEW_PROFILE');
        if (result.kind === 'VIEW_PROFILE') {
          expect(result.seat).toBe(1);
          expect(result.targetUserId).toBe('user-ghi');
        }
      });

      it('returns NOOP when tapping occupied seat without targetUserId', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.Seated,
          isAudioPlaying: false,
          seat: 1,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
          isSeatOccupiedByOther: true,
          isSelfSeated: false,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('SEATING_FLOW');
      });
    });

    describe('Ongoing phase', () => {
      it('returns ACTION_FLOW when imActioner is true', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.Ongoing,
          isAudioPlaying: false,
          seat: 2,
          disabledReason: undefined,
          imActioner: true,
          hasGameState: true,
          isSeatOccupiedByOther: false,
          isSelfSeated: false,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('ACTION_FLOW');
        if (result.kind === 'ACTION_FLOW') {
          expect(result.seat).toBe(2);
        }
      });

      it('returns NOOP(not_actioner) when imActioner is false', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.Ongoing,
          isAudioPlaying: false,
          seat: 2,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
          isSeatOccupiedByOther: false,
          isSelfSeated: false,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('NOOP');
        if (result.kind === 'NOOP') {
          expect(result.reason).toBe('not_actioner');
        }
      });
    });

    describe('Other statuses', () => {
      it('returns NOOP(other_status) for assigned status (empty seat)', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.Assigned,
          isAudioPlaying: false,
          seat: 0,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
          isSeatOccupiedByOther: false,
          isSelfSeated: false,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('NOOP');
        if (result.kind === 'NOOP') {
          expect(result.reason).toBe('other_status');
        }
      });

      it('returns VIEW_PROFILE for assigned status (occupied seat)', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.Assigned,
          isAudioPlaying: false,
          seat: 2,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
          isSeatOccupiedByOther: true,
          isSelfSeated: false,
          targetUserId: 'user-assigned',
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('VIEW_PROFILE');
        if (result.kind === 'VIEW_PROFILE') {
          expect(result.targetUserId).toBe('user-assigned');
        }
      });

      it('returns NOOP(other_status) for ready status (empty seat)', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.Ready,
          isAudioPlaying: false,
          seat: 0,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
          isSeatOccupiedByOther: false,
          isSelfSeated: false,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('NOOP');
        if (result.kind === 'NOOP') {
          expect(result.reason).toBe('other_status');
        }
      });

      it('returns VIEW_PROFILE for ready status (occupied seat)', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.Ready,
          isAudioPlaying: false,
          seat: 1,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
          isSeatOccupiedByOther: true,
          isSelfSeated: false,
          targetUserId: 'user-ready',
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('VIEW_PROFILE');
        if (result.kind === 'VIEW_PROFILE') {
          expect(result.targetUserId).toBe('user-ready');
        }
      });

      it('returns NOOP(other_status) for ended status (empty seat)', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.Ended,
          isAudioPlaying: false,
          seat: 0,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
          isSeatOccupiedByOther: false,
          isSelfSeated: false,
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('NOOP');
        if (result.kind === 'NOOP') {
          expect(result.reason).toBe('other_status');
        }
      });

      it('returns VIEW_PROFILE for ended status (occupied seat)', () => {
        const input: SeatTapPolicyInput = {
          roomStatus: GameStatus.Ended,
          isAudioPlaying: false,
          seat: 4,
          disabledReason: undefined,
          imActioner: false,
          hasGameState: true,
          isSeatOccupiedByOther: true,
          isSelfSeated: false,
          targetUserId: 'user-ended',
        };

        const result = getSeatTapResult(input);

        expect(result.kind).toBe('VIEW_PROFILE');
        if (result.kind === 'VIEW_PROFILE') {
          expect(result.targetUserId).toBe('user-ended');
        }
      });
    });
  });

  // ==========================================================================
  // Self-tap: VIEW_PROFILE for own seat
  // ==========================================================================
  describe('Self-tap: VIEW_PROFILE for own seat', () => {
    it('returns VIEW_PROFILE when self-seated player taps own seat in unseated phase', () => {
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.Unseated,
        isAudioPlaying: false,
        seat: 2,
        disabledReason: undefined,
        imActioner: false,
        hasGameState: true,
        isSeatOccupiedByOther: false,
        isSelfSeated: true,
        myUserId: 'user-self',
      };

      const result = getSeatTapResult(input);

      expect(result.kind).toBe('VIEW_PROFILE');
      if (result.kind === 'VIEW_PROFILE') {
        expect(result.seat).toBe(2);
        expect(result.targetUserId).toBe('user-self');
      }
    });

    it('returns VIEW_PROFILE when self-seated player taps own seat in seated phase', () => {
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.Seated,
        isAudioPlaying: false,
        seat: 3,
        disabledReason: undefined,
        imActioner: false,
        hasGameState: true,
        isSeatOccupiedByOther: false,
        isSelfSeated: true,
        myUserId: 'user-self',
      };

      const result = getSeatTapResult(input);

      expect(result.kind).toBe('VIEW_PROFILE');
      if (result.kind === 'VIEW_PROFILE') {
        expect(result.seat).toBe(3);
        expect(result.targetUserId).toBe('user-self');
      }
    });

    it('returns VIEW_PROFILE when self-seated player taps own seat in assigned phase', () => {
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.Assigned,
        isAudioPlaying: false,
        seat: 1,
        disabledReason: undefined,
        imActioner: false,
        hasGameState: true,
        isSeatOccupiedByOther: false,
        isSelfSeated: true,
        myUserId: 'user-self',
      };

      const result = getSeatTapResult(input);

      expect(result.kind).toBe('VIEW_PROFILE');
      if (result.kind === 'VIEW_PROFILE') {
        expect(result.seat).toBe(1);
        expect(result.targetUserId).toBe('user-self');
      }
    });

    it('returns VIEW_PROFILE when self-seated player taps own seat in ended phase', () => {
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.Ended,
        isAudioPlaying: false,
        seat: 5,
        disabledReason: undefined,
        imActioner: false,
        hasGameState: true,
        isSeatOccupiedByOther: false,
        isSelfSeated: true,
        myUserId: 'user-self',
      };

      const result = getSeatTapResult(input);

      expect(result.kind).toBe('VIEW_PROFILE');
      if (result.kind === 'VIEW_PROFILE') {
        expect(result.seat).toBe(5);
        expect(result.targetUserId).toBe('user-self');
      }
    });

    it('does not return VIEW_PROFILE for self during ongoing phase (uses normal action flow)', () => {
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.Ongoing,
        isAudioPlaying: false,
        seat: 2,
        disabledReason: undefined,
        imActioner: true,
        hasGameState: true,
        isSeatOccupiedByOther: false,
        isSelfSeated: true,
        myUserId: 'user-self',
      };

      const result = getSeatTapResult(input);

      // During ongoing, self-tap goes through normal action flow, not profile
      expect(result.kind).toBe('ACTION_FLOW');
    });

    it('returns SEATING_FLOW for empty seat when player is not seated (tapping empty seat is not self)', () => {
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.Unseated,
        isAudioPlaying: false,
        seat: 4,
        disabledReason: undefined,
        imActioner: false,
        hasGameState: true,
        isSeatOccupiedByOther: false,
        isSelfSeated: false,
      };

      const result = getSeatTapResult(input);

      expect(result.kind).toBe('SEATING_FLOW');
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================
  describe('Edge cases', () => {
    it('returns NOOP(no_game_state) when hasGameState is false', () => {
      const input: SeatTapPolicyInput = {
        roomStatus: GameStatus.Ongoing,
        isAudioPlaying: false,
        seat: 0,
        disabledReason: undefined,
        imActioner: true,
        hasGameState: false,
        isSeatOccupiedByOther: false,
        isSelfSeated: false,
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
        seat: 0,
        disabledReason: undefined,
        imActioner: true,
        hasGameState: false, // No game state means undefined status
        isSeatOccupiedByOther: false,
        isSelfSeated: false,
      };

      const result = getSeatTapResult(input);

      expect(result.kind).toBe('NOOP');
    });
  });
});
