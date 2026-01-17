/**
 * Jest global setup file
 * Mocks external dependencies that are not available in test environment
 */

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
