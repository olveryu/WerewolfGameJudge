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

import { getInteractionResult } from '../RoomInteractionPolicy';
import type { InteractionContext, InteractionEvent } from '../types';
import { INTERACTION_PRIORITY } from '../types';
import { GameStatus } from '../../../../models/Room';

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
    mySeatNumber: 0,
    myRole: 'villager',
    ...overrides,
  };
}

function createSeatTapEvent(
  seatIndex: number,
  disabledReason?: string,
): InteractionEvent {
  return { kind: 'SEAT_TAP', seatIndex, disabledReason };
}

function createBottomActionEvent(): InteractionEvent {
  return {
    kind: 'BOTTOM_ACTION',
    intent: { type: 'actionConfirm', targetIndex: 1, message: 'Test' },
  };
}

function createHostControlEvent(
  action: 'settings' | 'prepareToFlip' | 'startGame' | 'lastNightInfo' | 'restart' | 'bgmToggle',
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
    expect(INTERACTION_PRIORITY.AUDIO_GATE).toBeLessThan(
      INTERACTION_PRIORITY.NO_GAME_STATE,
    );
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
      const ctx = createBaseContext({ myRole: null });
      const event = createViewRoleEvent();

      const result = getInteractionResult(ctx, event);

      expect(result.kind).toBe('NOOP');
      expect(result).toHaveProperty('reason', 'no_role');
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
