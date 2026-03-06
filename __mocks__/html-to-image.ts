/**
 * Mock for html-to-image module (used on web only)
 * Used by Jest via moduleNameMapper
 */
export function toPng(_node: HTMLElement, _options?: Record<string, unknown>): Promise<string> {
  return Promise.resolve('data:image/png;base64,mock-html-to-image-data');
}
