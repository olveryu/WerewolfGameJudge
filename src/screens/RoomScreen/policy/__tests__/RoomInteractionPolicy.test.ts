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

import { getInteractionResult } from '@/screens/RoomScreen/policy/RoomInteractionPolicy';
import type { InteractionContext, InteractionEvent } from '@/screens/RoomScreen/policy/types';
import { INTERACTION_PRIORITY } from '@/screens/RoomScreen/policy/types';
import { GameStatus } from '@/models/GameStatus';

// =============================================================================
// Test Helpers
// =============================================================================

function createBaseContext(overrides: Partial<InteractionContext> = {}): InteractionContext {
  return {
    roomStatus: GameStatus.ongoing,
    hasGameState: true,
    isAudioPlaying: false,
    pendingRevealAck: false,
    pendingHunterGate: false,
    isHost: false,
    imActioner: true,
    // Real identity (for display)
    mySeatNumber: 0,
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

function createSeatTapEvent(seatIndex: number, disabledReason?: string): InteractionEvent {
  return { kind: 'SEAT_TAP', seatIndex, disabledReason };
}

function createBottomActionEvent(): InteractionEvent {
  return {
    kind: 'BOTTOM_ACTION',
    intent: { type: 'actionConfirm', targetIndex: 1, message: 'Test' },
  };
}

function createHostControlEvent(
  action: 'settings' | 'prepareToFlip' | 'startGame' | 'lastNightInfo' | 'restart',
): InteractionEvent {
  return { kind: 'HOST_CONTROL', action };
}

function createViewRoleEvent(): InteractionEvent {
  return { kind: 'VIEW_ROLE' };
}

function createLeaveRoomEvent(): InteractionEvent {
  return { kind: 'LEAVE_ROOM' };
}

function createRevealAckEvent(
  revealRole: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot',
): InteractionEvent {
  return { kind: 'REVEAL_ACK', revealRole };
}

function createWolfRobotHunterStatusViewedEvent(): InteractionEvent {
  return { kind: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED' };
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
        roomStatus: GameStatus.ongoing,
      });
      const event = createSeatTapEvent(1, '不能选择自己');

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'audio_playing');
    });

    test('audio_playing blocks bottom action', () => {
      const ctx = createBaseContext({
        isAudioPlaying: true,
        roomStatus: GameStatus.ongoing,
      });
      const event = createBottomActionEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'audio_playing');
    });

    test('audio_playing blocks view role', () => {
      const ctx = createBaseContext({
        isAudioPlaying: true,
        roomStatus: GameStatus.ongoing,
      });
      const event = createViewRoleEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'audio_playing');
    });

    test('audio_playing blocks host control during ongoing', () => {
      const ctx = createBaseContext({
        isAudioPlaying: true,
        roomStatus: GameStatus.ongoing,
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
        roomStatus: GameStatus.ongoing,
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
        roomStatus: GameStatus.ongoing,
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      // Audio gate should win (checked first)
      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'audio_playing');
    });
  });

  describe('Priority 3: Pending Reveal Ack', () => {
    test('pending_reveal_ack blocks seat tap during ongoing', () => {
      const ctx = createBaseContext({
        pendingRevealAck: true,
        roomStatus: GameStatus.ongoing,
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'pending_reveal_ack');
    });

    test('pending_reveal_ack blocks bottom action during ongoing', () => {
      const ctx = createBaseContext({
        pendingRevealAck: true,
        roomStatus: GameStatus.ongoing,
      });
      const event = createBottomActionEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'pending_reveal_ack');
    });

    test('pending_reveal_ack does NOT block leave room', () => {
      const ctx = createBaseContext({
        pendingRevealAck: true,
        roomStatus: GameStatus.ongoing,
      });
      const event = createLeaveRoomEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('SHOW_DIALOG');
      expect(result).toHaveProperty('dialogType', 'leaveRoom');
    });

    test('pending_reveal_ack is ignored outside ongoing phase', () => {
      const ctx = createBaseContext({
        pendingRevealAck: true,
        roomStatus: GameStatus.seated,
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      // Should route to seating flow, not block
      expect(result.kind).toBe('SEATING_FLOW');
    });

    test('audio gate beats pending_reveal_ack', () => {
      const ctx = createBaseContext({
        isAudioPlaying: true,
        pendingRevealAck: true,
        roomStatus: GameStatus.ongoing,
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      expect(result).toHaveProperty('reason', 'audio_playing');
    });
  });

  describe('Priority 4: Pending Hunter Gate', () => {
    test('pending_hunter_gate blocks seat tap during ongoing', () => {
      const ctx = createBaseContext({
        pendingHunterGate: true,
        roomStatus: GameStatus.ongoing,
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'pending_hunter_gate');
    });

    test('pending_reveal_ack beats pending_hunter_gate', () => {
      const ctx = createBaseContext({
        pendingRevealAck: true,
        pendingHunterGate: true,
        roomStatus: GameStatus.ongoing,
      });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      expect(result).toHaveProperty('reason', 'pending_reveal_ack');
    });

    test('pending_hunter_gate does NOT block leave room', () => {
      const ctx = createBaseContext({
        pendingHunterGate: true,
        roomStatus: GameStatus.ongoing,
      });
      const event = createLeaveRoomEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('SHOW_DIALOG');
      expect(result).toHaveProperty('dialogType', 'leaveRoom');
    });
  });
});

// =============================================================================
// Event Routing Tests
// =============================================================================

describe('RoomInteractionPolicy - Event Routing', () => {
  describe('SEAT_TAP', () => {
    test('routes to SEATING_FLOW during unseated phase', () => {
      const ctx = createBaseContext({ roomStatus: GameStatus.unseated });
      const event = createSeatTapEvent(3);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('SEATING_FLOW');
      expect(result).toHaveProperty('seatIndex', 3);
    });

    test('routes to SEATING_FLOW during seated phase', () => {
      const ctx = createBaseContext({ roomStatus: GameStatus.seated });
      const event = createSeatTapEvent(5);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('SEATING_FLOW');
      expect(result).toHaveProperty('seatIndex', 5);
    });

    test('routes to ACTION_FLOW when imActioner during ongoing', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.ongoing,
        imActioner: true,
      });
      const event = createSeatTapEvent(2);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('ACTION_FLOW');
      expect(result).toHaveProperty('seatIndex', 2);
    });

    test('returns NOOP when not actioner during ongoing', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.ongoing,
        imActioner: false,
      });
      const event = createSeatTapEvent(2);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'not_actioner');
    });

    test('returns ALERT when seat has disabledReason', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.ongoing,
        imActioner: true,
      });
      const event = createSeatTapEvent(0, '不能选择自己');

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('ALERT');
      expect(result).toHaveProperty('title', '不可选择');
      expect(result).toHaveProperty('message', '不能选择自己');
    });

    test('returns NOOP during ended phase', () => {
      const ctx = createBaseContext({ roomStatus: GameStatus.ended });
      const event = createSeatTapEvent(1);

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'other_status');
    });
  });

  describe('BOTTOM_ACTION', () => {
    test('routes to ACTION_FLOW when actioner', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.ongoing,
        imActioner: true,
      });
      const event = createBottomActionEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('ACTION_FLOW');
      expect(result).toHaveProperty('intent');
    });

    test('returns NOOP when not actioner during ongoing', () => {
      const ctx = createBaseContext({
        roomStatus: GameStatus.ongoing,
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
        roomStatus: GameStatus.seated,
      });
      const event = createHostControlEvent('startGame');

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('HOST_CONTROL');
      expect(result).toHaveProperty('action', 'startGame');
    });

    test('returns NOOP when not host', () => {
      const ctx = createBaseContext({
        isHost: false,
        roomStatus: GameStatus.seated,
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
        mySeatNumber: null,
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

  describe('REVEAL_ACK', () => {
    test('routes to REVEAL_ACK result with seer role', () => {
      const ctx = createBaseContext();
      const event = createRevealAckEvent('seer');

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('REVEAL_ACK');
      expect(result).toHaveProperty('revealRole', 'seer');
    });

    test('routes to REVEAL_ACK result with psychic role', () => {
      const ctx = createBaseContext();
      const event = createRevealAckEvent('psychic');

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('REVEAL_ACK');
      expect(result).toHaveProperty('revealRole', 'psychic');
    });

    test('routes to REVEAL_ACK result with gargoyle role', () => {
      const ctx = createBaseContext();
      const event = createRevealAckEvent('gargoyle');

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('REVEAL_ACK');
      expect(result).toHaveProperty('revealRole', 'gargoyle');
    });

    test('routes to REVEAL_ACK result with wolfRobot role', () => {
      const ctx = createBaseContext();
      const event = createRevealAckEvent('wolfRobot');

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('REVEAL_ACK');
      expect(result).toHaveProperty('revealRole', 'wolfRobot');
    });

    test('blocked by audio gate during ongoing', () => {
      const ctx = createBaseContext({
        isAudioPlaying: true,
        roomStatus: GameStatus.ongoing,
      });
      const event = createRevealAckEvent('seer');

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'audio_playing');
    });
  });

  describe('WOLF_ROBOT_HUNTER_STATUS_VIEWED', () => {
    test('routes to HUNTER_STATUS_VIEWED result', () => {
      const ctx = createBaseContext();
      const event = createWolfRobotHunterStatusViewedEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('HUNTER_STATUS_VIEWED');
    });

    test('blocked by audio gate during ongoing', () => {
      const ctx = createBaseContext({
        isAudioPlaying: true,
        roomStatus: GameStatus.ongoing,
      });
      const event = createWolfRobotHunterStatusViewedEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'audio_playing');
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
      pendingRevealAck: false,
      pendingHunterGate: false,
      hasGameState: true,
      roomStatus: GameStatus.ongoing,
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
        mySeatNumber: 0,
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
        mySeatNumber: 0, // real seat
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
        mySeatNumber: 0,
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
        mySeatNumber: 0,
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
        mySeatNumber: 0,
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
