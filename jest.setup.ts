/**
 * Jest global setup file
 * Mocks external dependencies that are not available in test environment
 */

// Reanimated jest mock (must be before any component imports)
require('react-native-reanimated').setUpTests();

// ---------------------------------------------------------------------------
// Suppress noisy React warnings (common in async component tests)
// These warnings are informational and don't indicate test failures.
// Using jest.spyOn to intercept — auto-tracked by Jest, restorable if needed.
// ---------------------------------------------------------------------------

const _originalError = console.error.bind(console);
const _originalWarn = console.warn.bind(console);

jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
  const first = args[0];
  const message = typeof first === 'string' ? first : '';
  // Filter out React act() warnings - they're noisy but don't affect test validity
  if (message.includes('not wrapped in act(')) {
    return;
  }
  _originalError(...args);
});

jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  // React uses format strings like "%s\n\n%s\n" with actual messages in subsequent args
  // Check all args for the error boundary message
  const allText = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');
  // Filter out React error boundary suggestions in tests
  if (allText.includes('An error occurred') || allText.includes('error boundary')) {
    return;
  }
  _originalWarn(...args);
});

// ---------------------------------------------------------------------------
// Theme mock for tests — shared data (single source of truth)
// ---------------------------------------------------------------------------
const mockColors = {
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
  wolf: '#DC2626',
  god: '#7C3AED',
  villager: '#16A34A',
  third: '#CA8A04',
};

const mockAvailableThemes = [
  { key: 'light', name: '浅色', colors: mockColors },
  { key: 'dark', name: '深色', colors: mockColors },
];

function mockCreateTheme() {
  return {
    colors: mockColors,
    isDark: false,
    toggleTheme: jest.fn(),
    setColorScheme: jest.fn(),
    themeKey: 'light',
    setTheme: jest.fn(),
    availableThemes: mockAvailableThemes,
  };
}

// Mock ThemeProvider
jest.mock('./src/theme/ThemeProvider', () => {
  const React = require('react');
  const theme = mockCreateTheme();

  return {
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    ThemeContext: React.createContext(theme),
    useTheme: () => theme,
    useColors: () => mockColors,
  };
});

// Mock theme index - must define all exports inline to avoid circular reference
jest.mock('./src/theme', () => {
  const React = require('react');
  const theme = mockCreateTheme();

  return {
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    ThemeContext: React.createContext(theme),
    useTheme: () => theme,
    useColors: () => mockColors,
    spacing: {
      tight: 4,
      small: 8,
      medium: 16,
      large: 24,
      xlarge: 32,
      xxlarge: 48,
    },
    typography: {
      caption: 12,
      secondary: 14,
      body: 16,
      subtitle: 18,
      title: 20,
      heading: 24,
      hero: 32,
      display: 40,
      weights: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
    borderRadius: {
      none: 0,
      small: 8,
      medium: 12,
      large: 16,
      xlarge: 24,
      full: 9999,
    },
    shadows: {
      none: {},
      sm: { boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' },
      md: { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' },
      lg: { boxShadow: '0px 4px 8px rgba(0,0,0,0.15)' },
    },
    crossPlatformTextShadow: (
      color: string,
      offsetX: number,
      offsetY: number,
      blurRadius: number,
    ) => ({
      textShadowColor: color,
      textShadowOffset: { width: offsetX, height: offsetY },
      textShadowRadius: blurRadius,
    }),
    layout: {
      maxWidth: 600,
      headerHeight: 56,
      tabBarHeight: 56,
      screenPaddingH: 16,
      screenPaddingV: 24,
      cardPadding: 16,
      listItemGap: 8,
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
jest.mock('./src/services/infra/supabaseClient', () => ({
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
  isSupabaseConfigured: jest.fn(() => true),
}));

// Mock Supabase config values (pure config — no client creation)
jest.mock('./src/config/supabase', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  isSupabaseConfigured: jest.fn(() => true),
}));

// Mock navigationRef — prevents createNavigationContainerRef from being called
// in tests where @react-navigation/native is mocked as empty object.
jest.mock('./src/navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(() => false), navigate: jest.fn() },
  navigateTo: jest.fn(),
}));

// ---------------------------------------------------------------------------
// ServiceContext mock — provides default mock services globally.
// Individual tests can override via jest.mock() or by wrapping with a real
// ServiceProvider + custom services.
// ---------------------------------------------------------------------------
jest.mock('./src/contexts/ServiceContext', () => {
  const mockServices = {
    authService: {
      waitForInit: jest.fn().mockResolvedValue(undefined),
      getCurrentUserId: jest.fn().mockReturnValue('test-uid'),
      getCurrentUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      getCurrentDisplayName: jest.fn().mockResolvedValue('Test User'),
      getCurrentAvatarUrl: jest.fn().mockResolvedValue(null),
      autoSignIn: jest.fn().mockResolvedValue(undefined),
      signInAnonymously: jest.fn().mockResolvedValue({ data: null, error: null }),
      signOut: jest.fn().mockResolvedValue(undefined),
      updateProfile: jest.fn().mockResolvedValue({ data: null, error: null }),
      onAuthStateChange: jest
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
    roomService: {
      createRoom: jest.fn().mockResolvedValue({
        roomNumber: '1234',
        hostUid: 'test-uid',
        createdAt: new Date(),
      }),
      getRoom: jest.fn().mockResolvedValue({
        roomNumber: '1234',
        hostUid: 'test-uid',
        createdAt: new Date(),
      }),
      deleteRoom: jest.fn().mockResolvedValue(undefined),
    },
    settingsService: {
      load: jest.fn().mockResolvedValue(undefined),
      getRoleRevealAnimation: jest.fn().mockReturnValue('random'),
      setRoleRevealAnimation: jest.fn(),
      isBgmEnabled: jest.fn().mockReturnValue(true),
      toggleBgm: jest.fn().mockResolvedValue(false),
      getThemeKey: jest.fn().mockReturnValue('dark'),
      setThemeKey: jest.fn(),
      hasSeenAssistantHint: jest.fn().mockReturnValue(true),
      setHasSeenAssistantHint: jest.fn().mockResolvedValue(undefined),
      addListener: jest.fn().mockReturnValue(jest.fn()),
    },
    audioService: {
      playNightAudio: jest.fn().mockResolvedValue(undefined),
      playNightEndAudio: jest.fn().mockResolvedValue(undefined),
      playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
      playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
      preloadForRoles: jest.fn().mockResolvedValue(undefined),
      clearPreloaded: jest.fn(),
      cleanup: jest.fn(),
      startBgm: jest.fn().mockResolvedValue(undefined),
      stopBgm: jest.fn(),
    },
    avatarUploadService: {
      uploadAvatar: jest.fn().mockResolvedValue(null),
    },
  };

  return {
    __esModule: true,
    ServiceProvider: ({ children }: { children: unknown }) => children,
    useServices: jest.fn(() => mockServices),
  };
});

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
    facadeLog: mockLogger,
    gameStateLog: mockLogger,
    settingsLog: mockLogger,
    settingsServiceLog: mockLogger,
    bgmLog: mockLogger,
    chatLog: mockLogger,
    mapAuthError: jest.fn((msg: string) => msg),
    isExpectedAuthError: jest.fn(() => false),
  };
});
