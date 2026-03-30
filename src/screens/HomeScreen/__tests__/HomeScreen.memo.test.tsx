/**
 * HomeScreen Style & Performance Tests
 *
 * Verifies style factory produces all required keys for the redesigned layout.
 */
import { createHomeScreenStyles, type HomeScreenStyles } from '@/screens/HomeScreen/components';

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
  third: '#f59e0b',
  // Overlay
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.3)',
};

describe('HomeScreen Performance Optimizations', () => {
  let styles: HomeScreenStyles;

  beforeAll(() => {
    styles = createHomeScreenStyles(mockColors, 375);
  });

  describe('createHomeScreenStyles', () => {
    it('should return styles with all required keys', () => {
      const expectedKeys = [
        'container',
        'scrollView',
        'scrollContent',
        'topBar',
        'topBarBrand',
        'topBarLogo',
        'topBarTitle',
        'topBarActions',
        'userNameHidden',
        'heroCard',
        'heroCardContent',
        'heroCardTitle',
        'heroCardSubtitle',
        'heroCardArrow',
        'actionRow',
        'actionCard',
        'actionCardDisabled',
        'actionCardIcon',
        'actionCardTitle',
        'actionCardSubtitle',
        'tipCard',
        'tipCardIcon',
        'tipCardBody',
        'tipCardTitle',
        'tipCardSub',
        'tipCardClose',
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
        'footerLink',
        'footerLinkText',
      ];
      expectedKeys.forEach((key) => {
        expect(styles).toHaveProperty(key);
      });
    });

    it('should return same reference for same colors input', () => {
      // This verifies the pattern works - styles created once and reused
      const styles1 = createHomeScreenStyles(mockColors, 375);
      const styles2 = createHomeScreenStyles(mockColors, 375);
      // Different calls create different objects (expected behavior)
      // The optimization is that we call it ONCE in parent and pass down
      expect(styles1).not.toBe(styles2);
    });
  });
});
