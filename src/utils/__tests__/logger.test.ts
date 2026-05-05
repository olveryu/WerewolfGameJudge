/**
 * Tests for logger module exports.
 *
 * jest.setup.ts globally mocks @/utils/logger (silences console).
 * We use jest.requireActual to verify the real module exports.
 */

const actualLogger = jest.requireActual<typeof import('@/utils/logger')>('@/utils/logger');

describe('logger module exports', () => {
  it('exports the main log instance', () => {
    expect(actualLogger.log).toBeDefined();
    expect(typeof actualLogger.log.info).toBe('function');
    expect(typeof actualLogger.log.warn).toBe('function');
    expect(typeof actualLogger.log.error).toBe('function');
  });

  it('exports pre-configured logger extensions', () => {
    expect(actualLogger.authLog).toBeDefined();
    expect(actualLogger.settingsLog).toBeDefined();
    expect(actualLogger.gachaLog).toBeDefined();
    expect(actualLogger.realtimeLog).toBeDefined();
  });

  it('does not export removed mapAuthError/isExpectedAuthError', () => {
    expect('mapAuthError' in actualLogger).toBe(false);
    expect('isExpectedAuthError' in actualLogger).toBe(false);
  });
});
