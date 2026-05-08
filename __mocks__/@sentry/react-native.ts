/**
 * Mock for @sentry/react-native module
 * Used by Jest via moduleNameMapper
 */
module.exports = {
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setExtra: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn((cb: (scope: unknown) => void) =>
    cb({
      setExtra: jest.fn(),
      setTag: jest.fn(),
      setLevel: jest.fn(),
      setFingerprint: jest.fn(),
      setContext: jest.fn(),
    }),
  ),
  startSpan: jest.fn((_opts: unknown, cb: (span: unknown) => unknown) =>
    cb({ setAttribute: jest.fn(), end: jest.fn() }),
  ),
  startInactiveSpan: jest.fn(() => ({ end: jest.fn(), setAttribute: jest.fn() })),
  wrap: jest.fn((component: unknown) => component),
  ReactNavigationInstrumentation: jest.fn(),
  ReactNativeTracing: jest.fn(),
  reactNavigationIntegration: jest.fn(() => ({
    registerNavigationContainer: jest.fn(),
  })),
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
};
