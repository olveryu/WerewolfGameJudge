/**
 * Jest global setup file
 * Mocks external dependencies that are not available in test environment
 */

// ---------------------------------------------------------------------------
// Suppress noisy React warnings (common in async component tests)
// These warnings are informational and don't indicate test failures.
// ---------------------------------------------------------------------------

// Save originals before any other code runs
const _originalError = console.error.bind(console);
const _originalWarn = console.warn.bind(console);

// Override globally
console.error = function (...args: unknown[]) {
  const first = args[0];
  const message = typeof first === 'string' ? first : '';
  // Filter out React act() warnings - they're noisy but don't affect test validity
  if (message.includes('not wrapped in act(')) {
    return;
  }
  _originalError(...args);
};

console.warn = function (...args: unknown[]) {
  // React uses format strings like "%s\n\n%s\n" with actual messages in subsequent args
  // Check all args for the error boundary message
  const allText = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');
  // Filter out React error boundary suggestions in tests
  if (allText.includes('An error occurred') || allText.includes('error boundary')) {
    return;
  }
  _originalWarn(...args);
};

// ---------------------------------------------------------------------------
// Theme mock for tests
// ---------------------------------------------------------------------------
// Mock ThemeProvider
jest.mock('./src/theme/ThemeProvider', () => {
  const React = require('react');

  const colors = {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#1A1A1A',
    textSecondary: '#666666',
    textInverse: '#FFFFFF',
    primary: '#4A90D9',
    primaryLight: '#7AB3E8',
    secondary: '#6C757D',
    error: '#DC3545',
    warning: '#FFC107',
    success: '#28A745',
    border: '#E0E0E0',
    divider: '#EEEEEE',
    wolf: '#8B0000',
    wolfLight: '#CD5C5C',
    god: '#2196F3',
    villager: '#4CAF50',
    special: '#9C27B0',
  };

  const availableThemes = [
    { key: 'light', name: '浅色', colors },
    { key: 'dark', name: '深色', colors },
  ];

  const theme = {
    colors,
    isDark: false,
    toggleTheme: jest.fn(),
    setColorScheme: jest.fn(),
    themeKey: 'light',
    setTheme: jest.fn(),
    availableThemes,
  };

  return {
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    ThemeContext: React.createContext(theme),
    useTheme: () => theme,
    useColors: () => colors,
  };
});

// Mock theme index - must define all exports inline to avoid circular reference
jest.mock('./src/theme', () => {
  const React = require('react');

  const colors = {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#1A1A1A',
    textSecondary: '#666666',
    textInverse: '#FFFFFF',
    primary: '#4A90D9',
    primaryLight: '#7AB3E8',
    secondary: '#6C757D',
    error: '#DC3545',
    warning: '#FFC107',
    success: '#28A745',
    border: '#E0E0E0',
    divider: '#EEEEEE',
    wolf: '#8B0000',
    wolfLight: '#CD5C5C',
    god: '#2196F3',
    villager: '#4CAF50',
    special: '#9C27B0',
  };

  const availableThemes = [
    { key: 'light', name: '浅色', colors },
    { key: 'dark', name: '深色', colors },
  ];

  const theme = {
    colors,
    isDark: false,
    toggleTheme: jest.fn(),
    setColorScheme: jest.fn(),
    themeKey: 'light',
    setTheme: jest.fn(),
    availableThemes,
  };

  return {
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    ThemeContext: React.createContext(theme),
    useTheme: () => theme,
    useColors: () => colors,
    useTokens: () => ({
      spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
      borderRadius: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
      typography: {
        xs: 12,
        sm: 14,
        base: 16,
        lg: 18,
        xl: 20,
        '2xl': 24,
        '3xl': 30,
        '4xl': 36,
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      shadows: { none: {}, sm: {}, md: {}, lg: {} },
      layout: { maxWidth: 600, headerHeight: 56, tabBarHeight: 60, tileColumns: 4 },
    }),
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      xxl: 48,
    },
    typography: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    borderRadius: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      full: 9999,
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
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      },
      lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
      },
    },
    layout: {
      maxWidth: 600,
      headerHeight: 56,
      tabBarHeight: 60,
      tileColumns: 4,
    },
  };
});

// ---------------------------------------------------------------------------
// React Native test env stability
// ---------------------------------------------------------------------------
// Keep RN's public surface stable in Jest.
// - Avoid relying on internal RN module paths (they change between RN versions).
// - Defang NativeAnimatedHelper warnings/noise.
// - Make TouchableOpacity deterministic to avoid animation side effects.

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), { virtual: true });

// Provide a stable TouchableOpacity implementation without pulling in the full
// `react-native` entrypoint (which can require unavailable native TurboModules
// like DevMenu under Jest).
jest.mock(
  'react-native/Libraries/Components/Touchable/TouchableOpacity',
  () => {
    const React = require('react');

    function TouchableOpacityShim(props: any) {
      const { children, onPress, disabled, ...rest } = props;
      return React.createElement(
        'TouchableOpacity',
        { onPress, disabled, accessibilityRole: 'button', ...rest },
        children,
      );
    }

    return TouchableOpacityShim;
  },
  { virtual: true },
);

// Mock Supabase client
jest.mock('./src/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: jest
        .fn()
        .mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue({ status: 'ok' }),
    }),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Logger mock for tests (silence console output)
// ---------------------------------------------------------------------------
jest.mock('./src/utils/logger', () => {
  type MockLogger = {
    debug: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    extend: jest.Mock;
  };

  const createMockLogger = (): MockLogger => {
    const logger: MockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      extend: jest.fn(),
    };
    logger.extend.mockReturnValue(logger);
    return logger;
  };

  const mockLogger = createMockLogger();

  return {
    log: mockLogger,
    hostLog: mockLogger,
    playerLog: mockLogger,
    nightFlowLog: mockLogger,
    broadcastLog: mockLogger,
    audioLog: mockLogger,
    authLog: mockLogger,
    roomLog: mockLogger,
    gameRoomLog: mockLogger,
    configLog: mockLogger,
    roomScreenLog: mockLogger,
    homeLog: mockLogger,
    v2FacadeLog: mockLogger,
    gameStateLog: mockLogger,
  };
});
