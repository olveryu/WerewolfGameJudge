/**
 * RoleCardSimple.test.tsx - Tests for the no-animation role card modal
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RoleCardSimple } from '@/components/RoleCardSimple';
import type { RoleId } from '@/models/roles';

// Mock the theme hook
jest.mock('../../theme', () => ({
  useColors: () => ({
    surface: '#1F2937',
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    textInverse: '#FFFFFF',
    textMuted: '#6B7280',
    border: '#374151',
    overlay: 'rgba(0,0,0,0.85)',
    wolf: '#EF4444',
    god: '#6366F1',
  }),
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    tight: 4,
    small: 8,
    medium: 16,
    large: 24,
    xlarge: 32,
  },
  typography: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    '2xl': 24,
    caption: 12,
    secondary: 14,
    body: 16,
    subtitle: 18,
    title: 20,
    heading: 24,
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
  borderRadius: {
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
    small: 8,
    medium: 12,
    large: 16,
    xlarge: 24,
  },
  shadows: {
    none: {},
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
  },
}));

describe('RoleCardSimple', () => {
  const defaultProps = {
    visible: true,
    roleId: 'wolf' as RoleId,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when not visible', () => {
    const { queryByText } = render(<RoleCardSimple {...defaultProps} visible={false} />);
    expect(queryByText('狼人')).toBeNull();
  });

  it('renders nothing when roleId is null', () => {
    const { queryByText } = render(<RoleCardSimple {...defaultProps} roleId={null} />);
    expect(queryByText('狼人')).toBeNull();
  });

  it('renders role name when visible', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} />);
    expect(getByText('狼人')).toBeTruthy();
  });

  it('shows faction badge', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} />);
    expect(getByText('狼人阵营')).toBeTruthy();
  });

  it('shows role icon', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} />);
    expect(getByText('🐺')).toBeTruthy();
  });

  it('shows skill description section', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} />);
    expect(getByText('技能介绍')).toBeTruthy();
  });

  it('shows close button', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} />);
    expect(getByText('我知道了')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = render(<RoleCardSimple {...defaultProps} onClose={onClose} />);

    fireEvent.press(getByText('我知道了'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows correct faction for seer role', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} roleId="seer" />);
    expect(getByText('神职阵营')).toBeTruthy();
    expect(getByText('预言家')).toBeTruthy();
  });

  it('shows correct faction for villager role', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} roleId="villager" />);
    expect(getByText('平民阵营')).toBeTruthy();
    expect(getByText('普通村民')).toBeTruthy();
  });

  it('shows correct icon for witch role', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} roleId="witch" />);
    expect(getByText('🧙‍♀️')).toBeTruthy();
    expect(getByText('女巫')).toBeTruthy();
  });

  it('shows correct icon for hunter role', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} roleId="hunter" />);
    expect(getByText('🏹')).toBeTruthy();
    expect(getByText('猎人')).toBeTruthy();
  });
});
