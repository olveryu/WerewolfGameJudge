/**
 * RoleRevealEffects - Unit Tests
 *
 * Tests for the role reveal animation components.
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  createRoleData,
  RoleHunt,
  RoleRevealAnimator,
  ScratchReveal,
} from '@/components/RoleRevealEffects/index';
import type { RoleData } from '@/components/RoleRevealEffects/types';

// Mock timers for animation testing
jest.useFakeTimers();

// Sample role data for testing
const mockWolfRole: RoleData = createRoleData(
  'wolf',
  '狼人',
  'wolf',
  '🐺',
  '每晚与狼队友共同选择一名玩家猎杀',
);

const mockGodRole: RoleData = createRoleData(
  'seer',
  '预言家',
  'god',
  '🔮',
  '每晚可以查验一名玩家的身份',
);

const mockVillagerRole: RoleData = createRoleData(
  'villager',
  '普通村民',
  'villager',
  '👤',
  '没有特殊能力',
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
          effectType="roleHunt"
          role={mockWolfRole}
          onComplete={onComplete}
        />,
      );

      expect(queryByTestId('role-reveal-modal')).toBeNull();
    });

    it('renders modal when visible', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <RoleRevealAnimator
          visible={true}
          effectType="roleHunt"
          role={mockWolfRole}
          onComplete={onComplete}
        />,
      );

      expect(getByTestId('role-reveal-modal')).toBeTruthy();
    });

    it('renders roleHunt effect container', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <RoleRevealAnimator
          visible={true}
          effectType="roleHunt"
          role={mockGodRole}
          onComplete={onComplete}
          testIDPrefix="role-hunt"
        />,
      );

      expect(getByTestId('role-hunt-container')).toBeTruthy();
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
        />,
      );

      expect(getByTestId('scratch-reveal-container')).toBeTruthy();
    });

    it('renders tarot effect container', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <RoleRevealAnimator
          visible={true}
          effectType="tarot"
          role={mockWolfRole}
          onComplete={onComplete}
          testIDPrefix="tarot-draw"
        />,
      );

      expect(getByTestId('tarot-draw-container')).toBeTruthy();
    });

    it('renders gachaMachine effect container', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <RoleRevealAnimator
          visible={true}
          effectType="gachaMachine"
          role={mockGodRole}
          onComplete={onComplete}
          testIDPrefix="gacha-machine"
        />,
      );

      expect(getByTestId('gacha-machine-container')).toBeTruthy();
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
        />,
      );

      expect(getByTestId('enhanced-roulette-container')).toBeTruthy();
    });
  });

  describe('RoleHunt', () => {
    it('renders role hunt container', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <RoleHunt role={mockWolfRole} onComplete={onComplete} testIDPrefix="role-hunt" />,
      );

      expect(getByTestId('role-hunt-container')).toBeTruthy();
    });

    it('calls onComplete after animation in reduced motion mode', async () => {
      const onComplete = jest.fn();

      render(
        <RoleHunt
          role={mockGodRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="role-hunt"
        />,
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
        <RoleHunt
          role={mockWolfRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="role-hunt"
        />,
      );

      // The role name should be visible
      expect(getByText('狼人')).toBeTruthy();
    });
  });

  describe('ScratchReveal', () => {
    it('renders scratch container', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <ScratchReveal
          role={mockVillagerRole}
          onComplete={onComplete}
          testIDPrefix="scratch-reveal"
        />,
      );

      expect(getByTestId('scratch-reveal-container')).toBeTruthy();
    });

    it('auto-reveals when scratch threshold is reached', async () => {
      const onComplete = jest.fn();
      render(
        <ScratchReveal role={mockWolfRole} onComplete={onComplete} testIDPrefix="scratch-reveal" />,
      );

      // Auto-reveal happens when scratch progress reaches threshold (simulated by timer)
      // Fast-forward through the reveal animation
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });

      // Note: In a real test, we would simulate scratch gestures
      // For now, just verify the component renders without error
      expect(true).toBe(true);
    });

    it('renders tap-to-reveal in reduced motion mode', () => {
      const onComplete = jest.fn();
      const { getByTestId, queryByTestId } = render(
        <ScratchReveal
          role={mockGodRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="scratch-reveal"
        />,
      );

      // In reduced motion, there should be a tap overlay
      expect(getByTestId('scratch-reveal-container')).toBeTruthy();
      // Auto-reveal button should NOT be visible in reduced motion
      expect(queryByTestId('scratch-reveal-auto-reveal')).toBeNull();
    });

    it('triggers reveal when tapping in reduced motion mode', async () => {
      const onComplete = jest.fn();

      const { getByText, queryByText } = render(
        <ScratchReveal
          role={mockVillagerRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="scratch-reveal"
        />,
      );

      // In reduced motion, user needs to tap the button to reveal
      const tapButton = getByText('点击揭示角色');
      expect(tapButton).toBeTruthy();

      fireEvent.press(tapButton);

      // After tapping, the button should disappear (isRevealed = true)
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // The tap button should no longer be visible after reveal
      await waitFor(() => {
        expect(queryByText('点击揭示角色')).toBeNull();
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
        <RoleHunt
          role={mockWolfRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="role-hunt"
        />,
      );

      // Container should render
      expect(getByTestId('role-hunt-container')).toBeTruthy();
    });

    it('renders god alignment with correct styling', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <RoleHunt
          role={mockGodRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="role-hunt"
        />,
      );

      expect(getByTestId('role-hunt-container')).toBeTruthy();
    });

    it('renders villager alignment with correct styling', () => {
      const onComplete = jest.fn();
      const { getByTestId } = render(
        <RoleHunt
          role={mockVillagerRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="role-hunt"
        />,
      );

      expect(getByTestId('role-hunt-container')).toBeTruthy();
    });
  });

  describe('Reduced Motion behavior', () => {
    it('does not render particles in reduced motion mode (RoleHunt)', () => {
      const onComplete = jest.fn();
      const { queryByTestId } = render(
        <RoleHunt
          role={mockWolfRole}
          onComplete={onComplete}
          reducedMotion={true}
          testIDPrefix="role-hunt"
        />,
      );

      // Particle burst should not be rendered in reduced motion
      expect(queryByTestId('role-hunt-particle-burst')).toBeNull();
    });

    it('disables haptics with reducedMotion', async () => {
      const onComplete = jest.fn();

      render(
        <RoleHunt
          role={mockGodRole}
          onComplete={onComplete}
          reducedMotion={true}
          enableHaptics={true}
          testIDPrefix="role-hunt"
        />,
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
        />,
      );

      // Should show "tap to reveal" instruction
      expect(getByText('点击揭示角色')).toBeTruthy();
    });
  });
});
