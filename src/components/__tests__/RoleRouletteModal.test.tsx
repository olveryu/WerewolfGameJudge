/**
 * RoleRouletteModal.test.tsx - Tests for the roulette animation modal
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { RoleRouletteModal } from '../RoleRouletteModal';

import type { RoleId } from '../../models/roles';

// Mock the theme hook
jest.mock('../../theme', () => ({
  useColors: () => ({
    surface: '#1F2937',
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    border: '#374151',
  }),
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    '2xl': 24,
  },
  borderRadius: {
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
}));

// Mock Animated
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Animated.timing = jest.fn(() => ({
    start: (callback?: () => void) => {
      if (callback) setTimeout(callback, 0);
    },
  }));
  RN.Animated.spring = jest.fn(() => ({
    start: (callback?: () => void) => {
      if (callback) setTimeout(callback, 0);
    },
  }));
  RN.Animated.parallel = jest.fn((animations) => ({
    start: (callback?: () => void) => {
      animations.forEach((anim: { start: (cb?: () => void) => void }) => anim.start());
      if (callback) setTimeout(callback, 0);
    },
  }));
  return RN;
});

describe('RoleRouletteModal', () => {
  const allRoles: RoleId[] = ['wolf', 'seer', 'witch', 'villager'];
  const defaultProps = {
    visible: true,
    roleId: 'wolf' as RoleId,
    allRoles,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <RoleRouletteModal {...defaultProps} visible={false} />
    );
    expect(queryByText('🎰 命运轮盘')).toBeNull();
  });

  it('renders nothing when roleId is null', () => {
    const { queryByText } = render(
      <RoleRouletteModal {...defaultProps} roleId={null} />
    );
    expect(queryByText('🎰 命运轮盘')).toBeNull();
  });

  it('renders modal when visible', async () => {
    const { getByText } = render(<RoleRouletteModal {...defaultProps} />);
    
    await act(async () => {
      jest.runAllTimers();
    });
    
    // After animation, should show role card
    expect(getByText('狼人')).toBeTruthy();
  });

  it('shows role card after animation completes', async () => {
    const { getByText } = render(<RoleRouletteModal {...defaultProps} />);
    
    // Wait for animation to complete
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    
    // After reveal, should show role name
    await waitFor(() => {
      expect(getByText('狼人')).toBeTruthy();
    });
  });

  it('calls onClose when close button is pressed after reveal', async () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <RoleRouletteModal {...defaultProps} onClose={onClose} />
    );
    
    // Wait for animation to complete
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    
    // Find and press the close button
    await waitFor(() => {
      const closeButton = getByText('我知道了');
      fireEvent.press(closeButton);
    });
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows correct faction for wolf role', async () => {
    const { getByText } = render(<RoleRouletteModal {...defaultProps} roleId="wolf" />);
    
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    
    await waitFor(() => {
      expect(getByText('狼人阵营')).toBeTruthy();
    });
  });

  it('shows correct faction for seer role', async () => {
    const { getByText } = render(<RoleRouletteModal {...defaultProps} roleId="seer" />);
    
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    
    await waitFor(() => {
      expect(getByText('神职阵营')).toBeTruthy();
    });
  });

  it('shows correct faction for villager role', async () => {
    const { getByText } = render(<RoleRouletteModal {...defaultProps} roleId="villager" />);
    
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    
    await waitFor(() => {
      expect(getByText('平民阵营')).toBeTruthy();
    });
  });
});
