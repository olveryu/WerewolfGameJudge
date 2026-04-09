/**
 * Jest global setup file
 * Mocks external dependencies that are not available in test environment
 */

// Reanimated jest mock (must be before any component imports)
require('react-native-reanimated').setUpTests();

// Safe area context — global mock via __mocks__/react-native-safe-area-context.tsx
// (resolved by moduleNameMapper in jest.config.js)

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
      captionSmall: 10,
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
      lineHeights: {
        captionSmall: 14,
        caption: 16,
        secondary: 20,
        body: 24,
        subtitle: 26,
        title: 28,
        heading: 34,
        hero: 42,
        display: 50,
      },
      letterSpacing: {
        tight: -0.5,
        normal: 0,
        wide: 0.5,
        hero: -1,
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
    fixed: {
      borderWidth: 1,
      borderWidthThick: 2,
      borderWidthHighlight: 3,
      divider: 1,
      minTouchTarget: 44,
      maxContentWidth: 600,
      keyboardOffset: 24,
      activeOpacity: 0.7,
    },
    componentSizes: {
      button: { sm: 32, md: 44, lg: 56 },
      avatar: { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 },
      icon: { xs: 12, sm: 16, md: 20, lg: 24, xl: 32 },
      badge: { dot: 8, sm: 16, md: 20 },
      chip: { minWidth: 56, paddingH: 12, paddingV: 6 },
      handle: { width: 36, height: 4 },
      radio: { size: 20, dotSize: 10 },
      progressBar: { height: 2, borderRadius: 1 },
      modal: { minWidth: 280 },
      menu: { minWidth: 180, compactMinWidth: 140 },
      headerAction: { minWidth: 60 },
      header: 56,
      tabBar: 56,
    },
    textStyles: {
      caption: { fontSize: 12, lineHeight: 16 },
      captionSmall: { fontSize: 10, lineHeight: 14 },
      secondary: { fontSize: 14, lineHeight: 20 },
      secondarySemibold: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
      body: { fontSize: 16, lineHeight: 24 },
      bodyMedium: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
      bodySemibold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
      subtitle: { fontSize: 18, lineHeight: 26 },
      subtitleSemibold: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
      title: { fontSize: 20, lineHeight: 28 },
      titleBold: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
      heading: { fontSize: 24, lineHeight: 34 },
      headingBold: { fontSize: 24, lineHeight: 34, fontWeight: '700' },
    },
    withAlpha: (hex: string, opacity: number) => {
      const alpha = Math.round(opacity * 255)
        .toString(16)
        .toUpperCase()
        .padStart(2, '0');
      return hex + alpha;
    },
    createSharedStyles: (colors: Record<string, string>) => ({
      screenContainer: { flex: 1, backgroundColor: colors.background || '#FFFFFF' },
      cardBase: { backgroundColor: colors.surface || '#1A1A1A', borderRadius: 16, padding: 16 },
      cardElevated: { backgroundColor: colors.surface || '#1A1A1A', borderRadius: 16, padding: 16 },
      primaryButton: {
        backgroundColor: colors.primary || '#6366F1',
        borderRadius: 9999,
        minHeight: 44,
        paddingHorizontal: 24,
        justifyContent: 'center',
        alignItems: 'center',
      },
      primaryButtonText: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '600',
        color: colors.textInverse || '#000000',
      },
      secondaryButton: {
        backgroundColor: 'transparent',
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: colors.border || '#27272A',
        minHeight: 44,
        paddingHorizontal: 24,
        justifyContent: 'center',
        alignItems: 'center',
      },
      secondaryButtonText: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '600',
        color: colors.text || '#FFFFFF',
      },
      dangerButton: {
        backgroundColor: colors.error || '#EF4444',
        borderRadius: 9999,
        minHeight: 44,
        paddingHorizontal: 24,
        justifyContent: 'center',
        alignItems: 'center',
      },
      dangerButtonText: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '600',
        color: colors.textInverse || '#000000',
      },
      inputBase: {
        backgroundColor: colors.surface || '#1A1A1A',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border || '#27272A',
        paddingHorizontal: 16,
        paddingVertical: 8,
        minHeight: 44,
        fontSize: 16,
        lineHeight: 24,
        color: colors.text || '#FFFFFF',
      },
      modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.overlay || 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
      },
      modalBase: {
        backgroundColor: colors.surface || '#1A1A1A',
        borderRadius: 24,
        padding: 24,
        maxWidth: 600,
        width: '90%',
      },
      sheetOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.overlayLight || 'rgba(0,0,0,0.4)',
      },
      sheetBase: {
        backgroundColor: colors.surface || '#1A1A1A',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingTop: 16,
        paddingBottom: 24,
        paddingHorizontal: 20,
      },
      sheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 9999,
        backgroundColor: colors.borderLight || '#3F3F46',
        alignSelf: 'center',
        marginBottom: 16,
      },
      listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        gap: 8,
      },
      sectionTitle: {
        fontSize: 18,
        lineHeight: 26,
        fontWeight: '600',
        color: colors.text || '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 8,
      },
      iconButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: colors.background || '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
      },
    }),
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

// Mock navigationRef — prevents createNavigationContainerRef from being called
// in tests where @react-navigation/native is mocked as empty object.
jest.mock('./src/navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(() => false), navigate: jest.fn() },
}));

// ---------------------------------------------------------------------------
// AuthContext mock — provides a default anonymous user globally.
// Individual tests can override via jest.mock() if needed.
// ---------------------------------------------------------------------------
jest.mock('./src/contexts/AuthContext', () => ({
  __esModule: true,
  useAuthContext: () => ({
    user: {
      uid: 'test-uid',
      email: null,
      displayName: 'TestPlayer',
      avatarUrl: null,
      customAvatarUrl: null,
      isAnonymous: true,
    },
    loading: false,
    error: null,
    isAuthenticated: true,
    signInAnonymously: jest.fn(),
    signUpWithEmail: jest.fn(),
    signInWithEmail: jest.fn(),
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
    signOut: jest.fn(),
  }),
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
      getCurrentAvatarFrame: jest.fn().mockResolvedValue(null),
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
      getBgmTrack: jest.fn().mockReturnValue('random'),
      setBgmTrack: jest.fn(),
      getThemeKey: jest.fn().mockReturnValue('dark'),
      setThemeKey: jest.fn(),
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
    realtimeLog: mockLogger,
    audioLog: mockLogger,
    authLog: mockLogger,
    roomLog: mockLogger,
    gameRoomLog: mockLogger,
    configLog: mockLogger,
    roomScreenLog: mockLogger,
    homeLog: mockLogger,
    facadeLog: mockLogger,
    settingsLog: mockLogger,
    settingsServiceLog: mockLogger,
    bgmLog: mockLogger,
    chatLog: mockLogger,
    connectionLog: mockLogger,
    mapAuthError: jest.fn((msg: string) => msg),
    isExpectedAuthError: jest.fn(() => false),
  };
});
