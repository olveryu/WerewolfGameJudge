/**
 * Mock for react-native-view-shot module
 * Used by Jest via moduleNameMapper
 */
export function captureRef(_ref: unknown, _options?: Record<string, unknown>): Promise<string> {
  return Promise.resolve('mock-captured-base64-data');
}
