/**
 * Mock for expo-splash-screen module
 * Used by Jest via moduleNameMapper
 */
module.exports = {
  preventAutoHideAsync: jest.fn().mockResolvedValue(true),
  hideAsync: jest.fn().mockResolvedValue(true),
};
