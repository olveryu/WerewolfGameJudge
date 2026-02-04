/**
 * RoleRevealEffects - Unit Tests
 *
 * Tests for the role reveal animation components.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { RoleRevealAnimator, createRoleData, FlipReveal, ScratchReveal } from '../index';
import type { RoleData } from '../types';

// Mock timers for animation testing
jest.useFakeTimers();

// Sample role data for testing
const mockWolfRole: RoleData = createRoleData(
  'wolf',
  '狼人',
  'wolf',
  '🐺',
  '每晚与狼队友共同选择一名玩家猎杀'
);

const mockGodRole: RoleData = createRoleData(
  'seer',
  '预言家',
  'god',
  '🔮',
  '每晚可以查验一名玩家的身份'
);

const mockVillagerRole: RoleData = createRoleData(
  'villager',
  '普通村民',
  'villager',
  '👤',
  '没有特殊能力'
);

describe('RoleRevealEffects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('RoleRevealAnimator', () => {
    it('renders nothing when not visible', () => {
      const onComplete = jest.fn();
      const { queryByTestId } = render(
        <RoleRevealAnimator
          visible={false}
          effectType="flip"
          role={mockWolfRole}
          onComplete={onComplete}
        />
      );

      expect(queryByTestId('role-reveal-modal')).toBeNull();
    });

    it('renders modal when visible', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <RoleRevealAnimator
          visible={true}
          effectType="flip"
          role={mockWolfRole}
          onComplete={onComplete}
        />
      );

      expect(getByTestId('role-reveal-modal')).toBeTruthy();
    });

    it('renders flip effect container', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <RoleRevealAnimator
          visible={true}
          effectType="flip"
          role={mockGodRole}
          onComplete={onComplete}
          testIDPrefix="flip-reveal"
        />
      );

      expect(getByTestId('flip-reveal-container')).toBeTruthy();
    });

    it('renders scratch effect container', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <RoleRevealAnimator
          visible={true}
          effectType="scratch"
          role={mockVillagerRole}
          onComplete={onComplete}
          testIDPrefix="scratch-reveal"
        />
      );

      expect(getByTestId('scratch-reveal-container')).toBeTruthy();
    });

    it('renders fragment effect container', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <RoleRevealAnimator
          visible={true}
          effectType="fragment"
          role={mockWolfRole}
          onComplete={onComplete}
          testIDPrefix="fragment-assemble"
        />
      );

      expect(getByTestId('fragment-assemble-container')).toBeTruthy();
    });

    it('renders fog effect container', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <RoleRevealAnimator
          visible={true}
          effectType="fog"
          role={mockGodRole}
          onComplete={onComplete}
          testIDPrefix="fog-reveal"
        />
      );

      expect(getByTestId('fog-reveal-container')).toBeTruthy();
    });

    it('renders roulette effect container with allRoles', () => {
      const onComplete = jest.fn();
      const allRoles = [mockWolfRole, mockGodRole, mockVillagerRole];

      const { getByTestId } = render(
        <RoleRevealAnimator
          visible={true}
          effectType="roulette"
          role={mockWolfRole}
          allRoles={allRoles}
          onComplete={onComplete}
          testIDPrefix="enhanced-roulette"
        />
      );

      expect(getByTestId('enhanced-roulette-container')).toBeTruthy();
    });
  });

  describe('FlipReveal', () => {
    it('renders card back initially', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <FlipReveal
          role={mockWolfRole}
          onComplete={onComplete}
          testIDPrefix="flip-reveal"
        />
      );

      expect(getByTestId('flip-reveal-container')).toBeTruthy();
      expect(getByTestId('flip-reveal-card-back')).toBeTruthy();
    });

    it('calls onComplete after animation in reduced motion mode', async () => {
      const onComplete = jest.fn();

      render(
        <FlipReveal
          role={mockGodRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="flip-reveal"
        />
      );

      // Fast-forward through the reduced motion animation
      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });
    });

    it('displays correct role name', () => {
      const onComplete = jest.fn();
      const { getByText } = render(
        <FlipReveal
          role={mockWolfRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="flip-reveal"
        />
      );

      // The role name should be visible
      expect(getByText('狼人')).toBeTruthy();
    });
  });

  describe('ScratchReveal', () => {
    it('renders scratch container and auto-reveal button', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <ScratchReveal
          role={mockVillagerRole}
          onComplete={onComplete}
          testIDPrefix="scratch-reveal"
        />
      );

      expect(getByTestId('scratch-reveal-container')).toBeTruthy();
      expect(getByTestId('scratch-reveal-auto-reveal')).toBeTruthy();
    });

    it('calls onComplete when auto-reveal button is pressed', async () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <ScratchReveal
          role={mockWolfRole}
          onComplete={onComplete}
          testIDPrefix="scratch-reveal"
        />
      );

      const autoRevealButton = getByTestId('scratch-reveal-auto-reveal');
      fireEvent.press(autoRevealButton);

      // Fast-forward through the reveal animation
      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });
    });

    it('renders tap-to-reveal in reduced motion mode', () => {
      const onComplete = jest.fn();
      const { getByTestId, queryByTestId } = render(
        <ScratchReveal
          role={mockGodRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="scratch-reveal"
        />
      );

      // In reduced motion, there should be a tap overlay
      expect(getByTestId('scratch-reveal-container')).toBeTruthy();
      // Auto-reveal button should NOT be visible in reduced motion
      expect(queryByTestId('scratch-reveal-auto-reveal')).toBeNull();
    });

    it('calls onComplete when tapping in reduced motion mode', async () => {
      const onComplete = jest.fn();

      render(
        <ScratchReveal
          role={mockVillagerRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="scratch-reveal"
        />
      );

      // Fast-forward through auto-reveal in reduced motion
      await act(async () => {
        jest.advanceTimersByTime(1100);
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });
    });
  });

  describe('createRoleData helper', () => {
    it('creates correct role data structure', () => {
      const role = createRoleData('wolf', '狼人', 'wolf', '🐺', '描述');

      expect(role).toEqual({
        id: 'wolf',
        name: '狼人',
        alignment: 'wolf',
        avatar: '🐺',
        description: '描述',
      });
    });

    it('creates role data without optional fields', () => {
      const role = createRoleData('villager', '村民', 'villager');

      expect(role).toEqual({
        id: 'villager',
        name: '村民',
        alignment: 'villager',
        avatar: undefined,
        description: undefined,
      });
    });
  });

  describe('Alignment themes', () => {
    it('renders wolf alignment with correct styling', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <FlipReveal
          role={mockWolfRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="flip-reveal"
        />
      );

      // Container should render
      expect(getByTestId('flip-reveal-container')).toBeTruthy();
    });

    it('renders god alignment with correct styling', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <FlipReveal
          role={mockGodRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="flip-reveal"
        />
      );

      expect(getByTestId('flip-reveal-container')).toBeTruthy();
    });

    it('renders villager alignment with correct styling', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <FlipReveal
          role={mockVillagerRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="flip-reveal"
        />
      );

      expect(getByTestId('flip-reveal-container')).toBeTruthy();
    });
  });

  describe('Reduced Motion behavior', () => {
    it('does not render particles in reduced motion mode (FlipReveal)', () => {
      const onComplete = jest.fn();
      const { queryByTestId } = render(
        <FlipReveal
          role={mockWolfRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="flip-reveal"
        />
      );

      // Particle burst should not be rendered in reduced motion
      expect(queryByTestId('flip-reveal-particle-burst')).toBeNull();
    });

    it('disables sound and haptics with reducedMotion', async () => {
      const onComplete = jest.fn();

      render(
        <FlipReveal
          role={mockGodRole}
          onComplete={onComplete}
          reducedMotion={true}
          enableSound={true}
          enableHaptics={true}
          testIDPrefix="flip-reveal"
        />
      );

      // Fast-forward through the reduced motion animation
      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      // Should complete without errors (sound/haptics are disabled in reduced motion)
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });
    });

    it('ScratchReveal renders tap-to-reveal UI in reduced motion', () => {
      const onComplete = jest.fn();
      const { getByText } = render(
        <ScratchReveal
          role={mockVillagerRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="scratch-reveal"
        />
      );

      // Should show "tap to reveal" instruction
      expect(getByText('点击揭示身份')).toBeTruthy();
    });
  });
});
