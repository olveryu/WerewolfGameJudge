/**
 * NightEngine Unit Tests
 */

import { NightEngine, NightPhase } from '../../domain/NightEngine';
import { GameStatus, type LocalGameState } from '../../infra/StateStore';
import { buildNightPlan } from '../../../../models/roles';
import type { GameTemplate } from '../../../../models/Template';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestState(roles: string[] = ['wolf', 'seer', 'witch']): LocalGameState {
  const template: GameTemplate = {
    name: 'test',
    numberOfPlayers: roles.length,
    roles: roles as import('../../../../models/roles').RoleId[],
  };

  const players = new Map<number, import('../../infra/StateStore').LocalPlayer | null>();
  for (let i = 1; i <= roles.length; i++) {
    players.set(i, {
      uid: `player-${i}`,
      seatNumber: i,
      role: roles[i - 1] as import('../../../../models/roles').RoleId,
      hasViewedRole: true,
    });
  }

  return {
    roomCode: 'TEST01',
    hostUid: 'host-uid',
    status: GameStatus.ongoing,
    template,
    players,
    actions: new Map(),
    wolfVotes: new Map(),
    currentActionerIndex: -1,
    isAudioPlaying: false,
    lastNightDeaths: [],
    currentNightResults: {},
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('NightEngine', () => {
  let engine: NightEngine;

  beforeEach(() => {
    engine = new NightEngine();
  });

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  describe('start()', () => {
    it('should initialize from game state', () => {
      const state = createTestState(['wolf', 'seer', 'witch']);
      const stepInfo = engine.start(state);

      expect(engine.isActive()).toBe(true);
      expect(engine.getPhase()).toBe(NightPhase.NightBeginAudio);
      expect(stepInfo).not.toBeNull();
    });

    it('should start with plan', () => {
      const plan = buildNightPlan(['wolf', 'seer']);
      const stepInfo = engine.startWithPlan(plan);

      expect(engine.isActive()).toBe(true);
      expect(stepInfo).not.toBeNull();
      expect(engine.getTotalSteps()).toBe(plan.length);
    });
  });

  // ---------------------------------------------------------------------------
  // Phase Transitions
  // ---------------------------------------------------------------------------

  describe('phase transitions', () => {
    beforeEach(() => {
      const state = createTestState(['wolf', 'seer']);
      engine.start(state);
    });

    it('should transition through night begin audio', () => {
      expect(engine.getPhase()).toBe(NightPhase.NightBeginAudio);

      engine.onNightBeginAudioDone();
      expect(engine.getPhase()).toBe(NightPhase.RoleBeginAudio);
    });

    it('should transition through role begin audio', () => {
      engine.onNightBeginAudioDone();
      engine.onRoleBeginAudioDone();
      expect(engine.getPhase()).toBe(NightPhase.WaitingForAction);
    });

    it('should transition through action submission', () => {
      engine.onNightBeginAudioDone();
      engine.onRoleBeginAudioDone();

      const nextStep = engine.submitAction(1);
      expect(engine.getPhase()).toBe(NightPhase.RoleEndAudio);
      expect(nextStep).not.toBeNull();
    });

    it('should complete full night cycle', () => {
      const plan = buildNightPlan(['wolf']);
      engine.startWithPlan(plan);

      // Night begin
      engine.onNightBeginAudioDone();
      expect(engine.getPhase()).toBe(NightPhase.RoleBeginAudio);

      // Role begin
      engine.onRoleBeginAudioDone();
      expect(engine.getPhase()).toBe(NightPhase.WaitingForAction);

      // Submit action
      engine.submitAction(1);
      expect(engine.getPhase()).toBe(NightPhase.RoleEndAudio);

      // Role end -> no more roles -> night end
      engine.onRoleEndAudioDone();
      expect(engine.getPhase()).toBe(NightPhase.NightEndAudio);

      // Night end
      engine.onNightEndAudioDone();
      expect(engine.isEnded()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Step Info
  // ---------------------------------------------------------------------------

  describe('getCurrentStepInfo()', () => {
    it('should return step info', () => {
      const state = createTestState(['wolf', 'seer']);
      engine.start(state);
      engine.onNightBeginAudioDone();

      const stepInfo = engine.getCurrentStepInfo();
      expect(stepInfo).not.toBeNull();
      expect(stepInfo!.roleId).toBe('wolf');
      expect(stepInfo!.index).toBe(0);
    });

    it('should return null when not active', () => {
      expect(engine.getCurrentStepInfo()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  describe('recorded actions', () => {
    it('should record actions', () => {
      const state = createTestState(['wolf', 'seer']);
      engine.start(state);
      engine.onNightBeginAudioDone();
      engine.onRoleBeginAudioDone();

      engine.submitAction(3);

      const actions = engine.getRecordedActions();
      expect(actions.get('wolf')).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  describe('reset()', () => {
    it('should reset to idle', () => {
      const state = createTestState(['wolf']);
      engine.start(state);
      expect(engine.isActive()).toBe(true);

      engine.reset();
      expect(engine.getPhase()).toBe(NightPhase.Idle);
      expect(engine.isActive()).toBe(false);
    });
  });
});
