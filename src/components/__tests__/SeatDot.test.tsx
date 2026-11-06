import Ionicons from '@expo/vector-icons/Ionicons';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SeatDot } from '@/components/SeatDot';
import { colors, componentSizes, fixed, typography, withAlpha } from '@/theme';

describe('SeatDot', () => {
  it('renders the 1-based seat number with the plain base look by default', () => {
    const screen = render(<SeatDot seat={2} testID="dot" />);

    const dot = screen.getByTestId('dot');
    expect(dot.props.accessibilityLabel).toBe('3号');
    expect(screen.getByText('3')).toBeTruthy();

    expect(StyleSheet.flatten(dot.props.style)).toMatchObject({
      width: componentSizes.avatar.xs,
      height: componentSizes.avatar.xs,
      backgroundColor: colors.background,
      borderColor: colors.border,
    });
    expect(StyleSheet.flatten(screen.getByText('3').props.style)).toMatchObject({
      fontSize: typography.caption,
      fontWeight: typography.weights.bold,
      color: colors.text,
    });
  });

  it('shrinks to the badge size with captionSmall text when size is sm', () => {
    const screen = render(<SeatDot seat={0} size="sm" testID="dot" />);

    expect(StyleSheet.flatten(screen.getByTestId('dot').props.style)).toMatchObject({
      width: componentSizes.badge.md,
      height: componentSizes.badge.md,
    });
    expect(StyleSheet.flatten(screen.getByText('1').props.style)).toMatchObject({
      fontSize: typography.captionSmall,
      fontWeight: typography.weights.bold,
    });
  });

  it('renders the leader variant with primary ring, tint and flag marker', () => {
    const screen = render(<SeatDot seat={4} emphasis="leader" stateLabel="组队者" testID="dot" />);

    const dot = screen.getByTestId('dot');
    expect(dot.props.accessibilityLabel).toBe('5号，组队者');

    expect(StyleSheet.flatten(dot.props.style)).toMatchObject({
      width: componentSizes.avatar.sm,
      height: componentSizes.avatar.sm,
      borderColor: colors.primary,
      backgroundColor: withAlpha(colors.primary, 0.12),
    });
    expect(StyleSheet.flatten(screen.getByText('5').props.style)).toMatchObject({
      color: colors.primary,
    });
    expect(screen.UNSAFE_getByType(Ionicons).props.name).toBe('flag');
  });

  it('lets the leader variant size win over an explicit sm size', () => {
    const screen = render(<SeatDot seat={1} size="sm" emphasis="leader" testID="dot" />);

    expect(StyleSheet.flatten(screen.getByTestId('dot').props.style)).toMatchObject({
      width: componentSizes.avatar.sm,
      height: componentSizes.avatar.sm,
    });
  });

  it('renders the filled variant with a primary fill and inverse text', () => {
    const screen = render(<SeatDot seat={3} emphasis="filled" testID="dot" />);

    expect(StyleSheet.flatten(screen.getByTestId('dot').props.style)).toMatchObject({
      width: componentSizes.avatar.sm,
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    });
    expect(StyleSheet.flatten(screen.getByText('4').props.style)).toMatchObject({
      color: colors.textInverse,
    });
    expect(screen.UNSAFE_queryByType(Ionicons)).toBeNull();
  });

  it('dims and strikes the number through when withdrawn', () => {
    const screen = render(<SeatDot seat={2} withdrawn stateLabel="已退水" testID="dot" />);

    const dot = screen.getByTestId('dot');
    expect(dot.props.accessibilityLabel).toBe('3号，已退水');

    expect(StyleSheet.flatten(dot.props.style)).toMatchObject({
      opacity: fixed.disabledOpacity,
    });
    expect(StyleSheet.flatten(screen.getByText('3').props.style)).toMatchObject({
      textDecorationLine: 'line-through',
    });
  });
});
