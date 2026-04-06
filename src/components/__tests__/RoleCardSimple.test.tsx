/**
 * RoleCardSimple.test.tsx - Tests for the no-animation role card modal
 */
import { fireEvent, render } from '@testing-library/react-native';
import type { RoleId } from '@werewolf/game-engine/models/roles';

import { RoleCardSimple } from '@/components/RoleCardSimple';

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
    villager: '#22C55E',
    god: '#6366F1',
    third: '#F59E0B',
  }),
  withAlpha: (hex: string, opacity: number) => {
    const alpha = Math.round(opacity * 255)
      .toString(16)
      .padStart(2, '0');
    return `${hex}${alpha}`;
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    micro: 2,
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
    lineHeights: {
      caption: 16,
      captionSmall: 14,
      secondary: 20,
      body: 22,
      subtitle: 24,
      title: 28,
      heading: 32,
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
    sm: { boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' },
    md: { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' },
    lg: { boxShadow: '0px 4px 8px rgba(0,0,0,0.15)' },
  },
  fixed: {
    borderWidth: 1,
    borderWidthThick: 2,
    borderWidthHighlight: 3,
    divider: 1,
    minTouchTarget: 44,
    maxContentWidth: 600,
    keyboardOffset: 24,
    activeOpacity: 0.7,
    disabledOpacity: 0.5,
  },
  textStyles: {
    bodySemibold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
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

  it('renders role badge image', () => {
    const { getByTestId } = render(<RoleCardSimple {...defaultProps} />);
    expect(getByTestId('role-badge')).toBeTruthy();
  });

  it('shows skill description section', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} />);
    expect(getByText('技能介绍')).toBeTruthy();
  });

  it('shows close button', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} />);
    expect(getByText('知道了')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = render(<RoleCardSimple {...defaultProps} onClose={onClose} />);

    fireEvent.press(getByText('知道了'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows correct faction for seer role', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} roleId="seer" />);
    expect(getByText('神职阵营')).toBeTruthy();
    expect(getByText('预言家')).toBeTruthy();
  });

  it('shows correct faction for villager role', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} roleId="villager" />);
    expect(getByText('好人阵营')).toBeTruthy();
    expect(getByText('平民')).toBeTruthy();
  });

  it('shows correct icon for witch role', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} roleId="witch" />);
    expect(getByText('女巫')).toBeTruthy();
  });

  it('shows correct icon for hunter role', () => {
    const { getByText } = render(<RoleCardSimple {...defaultProps} roleId="hunter" />);
    expect(getByText('猎人')).toBeTruthy();
  });

  describe('seerLabel (dual-seer boards)', () => {
    it('prefixes role name with seerLabel when provided for seer', () => {
      const { getByText } = render(
        <RoleCardSimple {...defaultProps} roleId="seer" seerLabel={1} />,
      );
      expect(getByText('1号预言家')).toBeTruthy();
    });

    it('prefixes role name with seerLabel when provided for mirrorSeer', () => {
      // mirrorSeer displayAs='seer' → shows "预言家", seerLabel → "2号预言家"
      const { getByText } = render(
        <RoleCardSimple {...defaultProps} roleId={'mirrorSeer' as RoleId} seerLabel={2} />,
      );
      expect(getByText('2号预言家')).toBeTruthy();
    });

    it('does not prefix when seerLabel is undefined', () => {
      const { getByText } = render(<RoleCardSimple {...defaultProps} roleId="seer" />);
      expect(getByText('预言家')).toBeTruthy();
    });
  });
});
