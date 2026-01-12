/**
 * Jest global setup file
 * Mocks external dependencies that are not available in test environment
 */

// ---------------------------------------------------------------------------
// React Native test env stability
// ---------------------------------------------------------------------------
// Prevent Animated/TouchableOpacity internals from triggering renderer version checks
// when tests update TextInput and toggle button disabled/opacity.
// RN internal paths can vary between versions, so we mock it as a virtual module.
jest.mock(
  'react-native/Libraries/Animated/NativeAnimatedHelper',
  () => ({}),
  { virtual: true }
);

// TouchableOpacity triggers Animated timing on opacity transitions.
// In our current dependency set, that codepath hits a react vs react-native-renderer
// version mismatch check. For unit tests, a simple Pressable-based shim is sufficient.
jest.mock('react-native/Libraries/Components/Touchable/TouchableOpacity', () => {
  const React = require('react');
  const { Pressable } = require('react-native');

  function TouchableOpacityShim(props: any) {
    const { children, onPress, disabled, ...rest } = props;
    return React.createElement(
      Pressable,
      { onPress, disabled, accessibilityRole: 'button', ...rest },
      children
    );
  }

  return TouchableOpacityShim;
});

// Mock Supabase client
jest.mock('./src/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
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
