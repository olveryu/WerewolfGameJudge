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
  withScope: jest.fn((cb: (scope: unknown) => void) => cb({ setExtra: jest.fn() })),
  wrap: jest.fn((component: unknown) => component),
  ReactNavigationInstrumentation: jest.fn(),
  ReactNativeTracing: jest.fn(),
};
