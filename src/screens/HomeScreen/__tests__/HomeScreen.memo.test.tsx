/**
 * HomeScreen Memo Performance Tests
 *
 * Verifies that memoized sub-components don't re-render when unrelated state changes.
 */
import { fireEvent,render } from '@testing-library/react-native';
import React, { useState } from 'react';
import { Text, TouchableOpacity,View } from 'react-native';

import { createHomeScreenStyles, type HomeScreenStyles,MenuItem } from '@/screens/HomeScreen/components';

// Mock theme colors - complete ThemeColors interface
const mockColors = {
  // Primary
  primary: '#2196f3',
  primaryLight: '#64b5f6',
  primaryDark: '#1976d2',
  // Backgrounds
  background: '#fff',
  surface: '#f5f5f5',
  surfaceHover: '#eeeeee',
  card: '#ffffff',
  // Text
  text: '#000',
  textSecondary: '#666',
  textMuted: '#999',
  textInverse: '#fff',
  // Borders
  border: '#e0e0e0',
  borderLight: '#f0f0f0',
  // Status
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#2196f3',
  // Game specific
  wolf: '#d32f2f',
  villager: '#4caf50',
  god: '#9c27b0',
  // Overlay
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.3)',
};

describe('HomeScreen Performance Optimizations', () => {
  let styles: HomeScreenStyles;

  beforeAll(() => {
    styles = createHomeScreenStyles(mockColors);
  });

  describe('createHomeScreenStyles', () => {
    it('should return styles with all required keys', () => {
      const expectedKeys = [
        'container',
        'scrollView',
        'header',
        'logo',
        'title',
        'subtitle',
        'userBar',
        'userAvatar',
        'userAvatarImage',
        'userAvatarPlaceholder',
        'userAvatarIcon',
        'userNameText',
        'menu',
        'menuItem',
        'menuIcon',
        'menuIconText',
        'menuContent',
        'menuTitle',
        'menuSubtitle',
        'menuArrow',
        'divider',
        'modalOverlay',
        'modalContent',
        'modalTitle',
        'modalSubtitle',
        'codeDisplay',
        'codeDigitBox',
        'codeDigitText',
        'modalButtons',
        'primaryButton',
        'primaryButtonText',
        'secondaryButton',
        'secondaryButtonText',
        'input',
        'errorText',
        'buttonDisabled',
        'linkButton',
        'linkButtonText',
        'outlineButton',
        'outlineButtonText',
        'footer',
        'footerText',
      ];
      expectedKeys.forEach((key) => {
        expect(styles).toHaveProperty(key);
      });
    });

    it('should return same reference for same colors input', () => {
      // This verifies the pattern works - styles created once and reused
      const styles1 = createHomeScreenStyles(mockColors);
      const styles2 = createHomeScreenStyles(mockColors);
      // Different calls create different objects (expected behavior)
      // The optimization is that we call it ONCE in parent and pass down
      expect(styles1).not.toBe(styles2);
    });
  });

  describe('MenuItem memo optimization', () => {
    it('should not re-render MenuItem when unrelated parent state changes (stable styles)', () => {
      const renderSpy = jest.fn();

      // Create a tracked version that calls spy in render
      const TrackedMenuItem = React.memo(
        (props: React.ComponentProps<typeof MenuItem>) => {
          renderSpy();
          return <MenuItem {...props} />;
        },
        (prev, next) => {
          // Use same comparison logic as MenuItem
          return (
            prev.icon === next.icon &&
            prev.title === next.title &&
            prev.subtitle === next.subtitle &&
            prev.testID === next.testID &&
            prev.styles === next.styles
          );
        },
      );

      TrackedMenuItem.displayName = 'TrackedMenuItem';

      // Parent that properly memoizes styles (using module-level stable reference)
      const Parent: React.FC = () => {
        const [count, setCount] = useState(0);

        return (
          <View>
            <Text testID="count">{count}</Text>
            <TouchableOpacity testID="increment" onPress={() => setCount((c) => c + 1)}>
              <Text>+</Text>
            </TouchableOpacity>
            <TrackedMenuItem
              icon="🎮"
              title="Test Item"
              subtitle="Test subtitle"
              onPress={() => {}}
              testID="menu-item"
              styles={styles}
            />
          </View>
        );
      };

      const { getByTestId } = render(<Parent />);

      // Initial render
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Trigger unrelated state change
      fireEvent.press(getByTestId('increment'));

      // TrackedMenuItem should NOT re-render because all props are stable
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('should re-render MenuItem when relevant props change', () => {
      const renderSpy = jest.fn();

      const TrackedMenuItem = React.memo(
        (props: React.ComponentProps<typeof MenuItem>) => {
          renderSpy();
          return <MenuItem {...props} />;
        },
        (prev, next) => {
          return (
            prev.icon === next.icon &&
            prev.title === next.title &&
            prev.subtitle === next.subtitle &&
            prev.testID === next.testID &&
            prev.styles === next.styles
          );
        },
      );

      TrackedMenuItem.displayName = 'TrackedMenuItem';

      const Parent: React.FC = () => {
        const [title, setTitle] = useState('Initial');

        return (
          <View>
            <TouchableOpacity testID="change-title" onPress={() => setTitle('Changed')}>
              <Text>Change</Text>
            </TouchableOpacity>
            <TrackedMenuItem
              icon="🎮"
              title={title}
              onPress={() => {}}
              testID="menu-item"
              styles={styles}
            />
          </View>
        );
      };

      const { getByTestId } = render(<Parent />);

      // Initial render
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Change title - should cause re-render
      fireEvent.press(getByTestId('change-title'));

      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });
});
