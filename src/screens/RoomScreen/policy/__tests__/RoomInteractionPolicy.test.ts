/**
 * RoomInteractionPolicy.test.ts - Contract tests for unified interaction policy
 *
 * These tests lock the priority order and ensure all interaction paths work correctly.
 * Priority order (contract):
 * 1. Audio Gate (highest)
 * 2. No Game State
 * 3. Pending Reveal Ack
 * 4. Pending Hunter Gate
 * 5. Event Routing
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';

import { getInteractionResult } from '@/screens/RoomScreen/policy/RoomInteractionPolicy';
import type { InteractionContext, InteractionEvent } from '@/screens/RoomScreen/policy/types';
import { INTERACTION_PRIORITY } from '@/screens/RoomScreen/policy/types';

// =============================================================================
// Test Helpers
// =============================================================================

function createBaseContext(overrides: Partial<InteractionContext> = {}): InteractionContext {
  return {
    roomStatus: GameStatus.Ongoing,
    hasGameState: true,
    isAudioPlaying: false,
    hasPendingAck: false,
    isHost: false,
    imActioner: true,
    // Real identity (for display)
    mySeat: 0,
    myRole: 'villager',
    // Actor identity (for actions)
    actorSeatForUi: 0,
    actorRoleForUi: 'villager',
    // Debug mode (required, non-optional)
    isDebugMode: false,
    controlledSeat: null,
    isDelegating: false,
    ...overrides,
  };
}

function createSeatTapEvent(seat: number, disabledReason?: string): InteractionEvent {
  return { kind: 'SEAT_TAP', seat, disabledReason };
}

function createBottomActionEvent(): InteractionEvent {
  return {
    kind: 'BOTTOM_ACTION',
    intent: { type: 'actionConfirm', targetSeat: 1, message: 'Test' },
  };
}

function createHostControlEvent(
  action: 'settings' | 'prepareToFlip' | 'startGame' | 'restart',
): InteractionEvent {
  return { kind: 'HOST_CONTROL', action };
}

function createViewRoleEvent(): InteractionEvent {
  return { kind: 'VIEW_ROLE' };
}

function createLeaveRoomEvent(): InteractionEvent {
  return { kind: 'LEAVE_ROOM' };
}

// =============================================================================
// Priority Order Contract Tests
// =============================================================================

describe('RoomInteractionPolicy - Priority Order (Contract)', () => {
  test('priority constants are in correct order', () => {
    expect(INTERACTION_PRIORITY.AUDIO_GATE).toBeLessThan(INTERACTION_PRIORITY.NO_GAME_STATE);
    expect(INTERACTION_PRIORITY.NO_GAME_STATE).toBeLessThan(
      INTERACTION_PRIORITY.PENDING_REVEAL_ACK,
    );
    expect(INTERACTION_PRIORITY.PENDING_REVEAL_ACK).toBeLessThan(
      INTERACTION_PRIORITY.PENDING_HUNTER_GATE,
    );
    expect(INTERACTION_PRIORITY.PENDING_HUNTER_GATE).toBeLessThan(
      INTERACTION_PRIORITY.EVENT_ROUTING,
    );
  });

  describe('Priority 1: Audio Gate beats all others', () => {
    test('audio_playing blocks seat tap even with disabledReason', () => {
      const ctx = createBaseContext({
        isAudioPlaying: true,
        roomStatus: GameStatus.Ongoing,
      });
      const event = createSeatTapEvent(1, '不能选择自己');

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'audio_playing');
    });

    test('audio_playing blocks bottom action', () => {
      const ctx = createBaseContext({
        isAudioPlaying: true,
        roomStatus: GameStatus.Ongoing,
      });
      const event = createBottomActionEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'audio_playing');
    });

    test('audio_playing blocks view role', () => {
      const ctx = createBaseContext({
        isAudioPlaying: true,
        roomStatus: GameStatus.Ongoing,
      });
      const event = createViewRoleEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'audio_playing');
    });

    test('audio_playing blocks host control during ongoing', () => {
      const ctx = createBaseContext({
        isAudioPlaying: true,
        roomStatus: GameStatus.Ongoing,
        isHost: true,
      });
      const event = createHostControlEvent('restart');

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'audio_playing');
    });

    test('audio_playing does NOT block leave room (safety exit)', () => {
      const ctx = createBaseContext({
        isAudioPlaying: true,
        roomStatus: GameStatus.Ongoing,
      });
      const event = createLeaveRoomEvent();

      const result = getInteractionResult(ctx, event);

      // Leave room should always work
      expect(result.kind).toBe('SHOW_DIALOG');
      expect(result).toHaveProperty('dialogType', 'leaveRoom');
    });
  });

  describe('Priority 2: No Game State', () => {
    test('no_game_state blocks seat tap', () => {
      const ctx = createBaseContext({
        hasGameState: false,
        isAudioPlaying: false,
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'no_game_state');
    });

    test('audio gate beats no_game_state', () => {
      const ctx = createBaseContext({
        hasGameState: false,
        isAudioPlaying: true,
        roomStatus: GameStatus.Ongoing,
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      // Audio gate should win (checked first)
      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'audio_playing');
    });
  });

  describe('Priority 3: Pending Server-Ack', () => {
    test('hasPendingAck blocks seat tap during ongoing', () => {
      const ctx = createBaseContext({
        hasPendingAck: true,
        roomStatus: GameStatus.Ongoing,
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'pending_ack');
    });

    test('hasPendingAck blocks bottom action during ongoing', () => {
      const ctx = createBaseContext({
        hasPendingAck: true,
        roomStatus: GameStatus.Ongoing,
      });
      const event = createBottomActionEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'pending_ack');
    });

    test('hasPendingAck does NOT block leave room', () => {
      const ctx = createBaseContext({
        hasPendingAck: true,
        roomStatus: GameStatus.Ongoing,
      });
      const event = createLeaveRoomEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('SHOW_DIALOG');
      expect(result).toHaveProperty('dialogType', 'leaveRoom');
    });

    test('hasPendingAck is ignored outside ongoing phase', () => {
      const ctx = createBaseContext({
        hasPendingAck: true,
        roomStatus: GameStatus.Seated,
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      // Should route to seating flow, not block
      expect(result.kind).toBe('SEATING_FLOW');
    });

    test('audio gate beats hasPendingAck', () => {
      const ctx = createBaseContext({
        isAudioPlaying: true,
        hasPendingAck: true,
        roomStatus: GameStatus.Ongoing,
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      expect(result).toHaveProperty('reason', 'audio_playing');
    });
  });
});

// =============================================================================
// Event Routing Tests
// =============================================================================

describe('RoomInteractionPolicy - Event Routing', () => {
  describe('SEAT_TAP', () => {
    test('routes to SEATING_FLOW during unseated phase', () => {
      const ctx = createBaseContext({ roomStatus: GameStatus.Unseated });
      const event = createSeatTapEvent(3);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('SEATING_FLOW');
      expect(result).toHaveProperty('seat', 3);
    });

    test('routes to SEATING_FLOW during seated phase', () => {
      const ctx = createBaseContext({ roomStatus: GameStatus.Seated });
      const event = createSeatTapEvent(5);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('SEATING_FLOW');
      expect(result).toHaveProperty('seat', 5);
    });

    test('routes to ACTION_FLOW when imActioner during ongoing', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.Ongoing,
        imActioner: true,
      });
      const event = createSeatTapEvent(2);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('ACTION_FLOW');
      expect(result).toHaveProperty('seat', 2);
    });

    test('returns NOOP when not actioner during ongoing', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.Ongoing,
        imActioner: false,
      });
      const event = createSeatTapEvent(2);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'not_actioner');
    });

    test('returns ALERT when seat has disabledReason', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.Ongoing,
        imActioner: true,
      });
      const event = createSeatTapEvent(0, '不能选择自己');

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('ALERT');
      expect(result).toHaveProperty('title', '不可选择');
      expect(result).toHaveProperty('message', '不能选择自己');
    });

    test('returns NOOP during ended phase', () => {
      const ctx = createBaseContext({ roomStatus: GameStatus.Ended });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'other_status');
    });

    test('routes to VIEW_PROFILE when tapping occupied seat in seating phase', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.Seated,
        mySeat: 0,
        isHost: false,
        isSeatOccupied: () => true,
        getPlayerUid: () => 'user-xyz',
      });
      const event = createSeatTapEvent(3);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('VIEW_PROFILE');
      expect(result).toHaveProperty('seat', 3);
      expect(result).toHaveProperty('targetUserId', 'user-xyz');
    });

    test('host tapping occupied seat also routes to VIEW_PROFILE', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.Unseated,
        mySeat: 0,
        isHost: true,
        isSeatOccupied: () => true,
        getPlayerUid: () => 'user-host-target',
      });
      const event = createSeatTapEvent(2);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('VIEW_PROFILE');
      expect(result).toHaveProperty('targetUserId', 'user-host-target');
    });

    test('routes to VIEW_PROFILE in assigned phase', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.Assigned,
        mySeat: 0,
        isSeatOccupied: () => true,
        getPlayerUid: () => 'user-assigned',
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('VIEW_PROFILE');
      expect(result).toHaveProperty('targetUserId', 'user-assigned');
    });

    test('routes to VIEW_PROFILE in ready phase', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.Ready,
        mySeat: 0,
        isSeatOccupied: () => true,
        getPlayerUid: () => 'user-ready',
      });
      const event = createSeatTapEvent(2);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('VIEW_PROFILE');
      expect(result).toHaveProperty('targetUserId', 'user-ready');
    });

    test('routes to VIEW_PROFILE in ended phase', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.Ended,
        mySeat: 0,
        isSeatOccupied: () => true,
        getPlayerUid: () => 'user-ended',
      });
      const event = createSeatTapEvent(4);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('VIEW_PROFILE');
      expect(result).toHaveProperty('targetUserId', 'user-ended');
    });

    test('routes to VIEW_PROFILE when tapping own seat in seated phase (self-profile)', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.Seated,
        mySeat: 2,
        isSeatOccupied: (seat: number) => seat === 2,
        getPlayerUid: (seat: number) => (seat === 2 ? 'user-me' : undefined),
      });
      const event = createSeatTapEvent(2);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('VIEW_PROFILE');
      expect(result).toHaveProperty('seat', 2);
      expect(result).toHaveProperty('targetUserId', 'user-me');
    });

    test('routes to VIEW_PROFILE when tapping own seat in unseated phase (self-profile)', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.Unseated,
        mySeat: 1,
        isSeatOccupied: (seat: number) => seat === 1,
        getPlayerUid: (seat: number) => (seat === 1 ? 'user-me' : undefined),
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('VIEW_PROFILE');
      expect(result).toHaveProperty('seat', 1);
      expect(result).toHaveProperty('targetUserId', 'user-me');
    });
  });

  describe('BOTTOM_ACTION', () => {
    test('routes to ACTION_FLOW when actioner', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.Ongoing,
        imActioner: true,
      });
      const event = createBottomActionEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('ACTION_FLOW');
      expect(result).toHaveProperty('intent');
    });

    test('returns NOOP when not actioner during ongoing', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.Ongoing,
        imActioner: false,
      });
      const event = createBottomActionEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'not_actioner');
    });
  });

  describe('HOST_CONTROL', () => {
    test('routes to HOST_CONTROL when isHost', () => {
      const ctx = createBaseContext({
        isHost: true,
        roomStatus: GameStatus.Seated,
      });
      const event = createHostControlEvent('startGame');

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('HOST_CONTROL');
      expect(result).toHaveProperty('action', 'startGame');
    });

    test('returns NOOP when not host', () => {
      const ctx = createBaseContext({
        isHost: false,
        roomStatus: GameStatus.Seated,
      });
      const event = createHostControlEvent('startGame');

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'host_only');
    });
  });

  describe('VIEW_ROLE', () => {
    test('routes to SHOW_DIALOG when has role', () => {
      const ctx = createBaseContext({ myRole: 'seer' });
      const event = createViewRoleEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('SHOW_DIALOG');
      expect(result).toHaveProperty('dialogType', 'roleCard');
    });

    test('returns NOOP when no role', () => {
      const ctx = createBaseContext({ myRole: null, actorRoleForUi: null });
      const event = createViewRoleEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'no_role');
    });

    test('routes to SHOW_DIALOG when delegating bot with role (myRole null)', () => {
      // Host has no seat/role but is controlling a bot
      const ctx = createBaseContext({
        isHost: true,
        myRole: null,
        mySeat: null,
        actorRoleForUi: 'wolf',
        actorSeatForUi: 3,
        controlledSeat: 3,
        isDelegating: true,
        isDebugMode: true,
      });
      const event = createViewRoleEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('SHOW_DIALOG');
      expect(result).toHaveProperty('dialogType', 'roleCard');
    });
  });

  describe('LEAVE_ROOM', () => {
    test('always routes to SHOW_DIALOG', () => {
      const ctx = createBaseContext();
      const event = createLeaveRoomEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('SHOW_DIALOG');
      expect(result).toHaveProperty('dialogType', 'leaveRoom');
    });
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('RoomInteractionPolicy - Edge Cases', () => {
  test('all gates false routes to event handler', () => {
    const ctx = createBaseContext({
      isAudioPlaying: false,
      hasPendingAck: false,
      hasGameState: true,
      roomStatus: GameStatus.Ongoing,
      imActioner: true,
    });
    const event = createSeatTapEvent(1);

    const result = getInteractionResult(ctx, event);

    expect(result.kind).toBe('ACTION_FLOW');
  });

  test('undefined roomStatus returns NOOP from seat tap', () => {
    const ctx = createBaseContext({ roomStatus: undefined });
    const event = createSeatTapEvent(1);

    const result = getInteractionResult(ctx, event);

    expect(result.kind).toBe('NOOP');
    expect(result).toHaveProperty('reason', 'other_status');
  });
});

// =============================================================================
// Actor Identity Contract Tests (controlledSeat delegation)
// =============================================================================

describe('RoomInteractionPolicy - Actor Identity (Contract)', () => {
  describe('actorSeatForUi / actorRoleForUi are used for action decisions', () => {
    test('when not delegating: actorSeat equals mySeat', () => {
      const ctx = createBaseContext({
        mySeat: 0,
        myRole: 'villager',
        actorSeatForUi: 0,
        actorRoleForUi: 'villager',
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      // Not tapping self, should route to action
      expect(result.kind).toBe('ACTION_FLOW');
    });

    test('when delegating (controlledSeat): actorSeat differs from mySeat', () => {
      // Host (seat 0) controlling bot at seat 5 (wolf)
      const ctx = createBaseContext({
        isHost: true,
        mySeat: 0, // real seat
        myRole: 'seer', // real role
        actorSeatForUi: 5, // controlled bot seat
        actorRoleForUi: 'wolf', // controlled bot role
      });
      const event = createSeatTapEvent(3);

      const result = getInteractionResult(ctx, event);

      // Bot's perspective: tapping seat 3 as wolf
      expect(result.kind).toBe('ACTION_FLOW');
    });

    test('tapping own real seat while delegating is NOT self-tap (uses actorSeat)', () => {
      // Host at seat 0 is controlling bot at seat 5
      // Tapping seat 0 is NOT self-tap for the bot (actorSeat=5)
      const ctx = createBaseContext({
        isHost: true,
        mySeat: 0,
        myRole: 'seer',
        actorSeatForUi: 5,
        actorRoleForUi: 'wolf',
      });
      const event = createSeatTapEvent(0);

      const result = getInteractionResult(ctx, event);

      // From bot's perspective (seat 5), tapping seat 0 is a valid target
      expect(result.kind).toBe('ACTION_FLOW');
    });

    test('tapping controlled bot seat while delegating IS self-tap (uses actorSeat)', () => {
      // Host at seat 0 is controlling bot at seat 5
      // Tapping seat 5 IS self-tap for the bot
      const ctx = createBaseContext({
        isHost: true,
        mySeat: 0,
        myRole: 'seer',
        actorSeatForUi: 5,
        actorRoleForUi: 'wolf',
        // If schema says "notSelf", seat 5 would have disabledReason
      });
      const event = createSeatTapEvent(5, '不能选择自己');

      const result = getInteractionResult(ctx, event);

      // With disabledReason, should show alert
      expect(result.kind).toBe('ALERT');
    });
  });

  describe('bottom action uses actor identity', () => {
    test('bottom action proceeds with actor identity context', () => {
      const ctx = createBaseContext({
        isHost: true,
        mySeat: 0,
        myRole: 'seer',
        actorSeatForUi: 5,
        actorRoleForUi: 'wolf',
        imActioner: true,
      });
      const event = createBottomActionEvent();

      const result = getInteractionResult(ctx, event);

      // Bottom action routes through ACTION_FLOW
      expect(result.kind).toBe('ACTION_FLOW');
    });
  });
});
