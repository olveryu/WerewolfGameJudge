/**
 * Mock for expo-clipboard module
 * Used by Jest via moduleNameMapper
 */

export const setStringAsync = jest.fn().mockResolvedValue(undefined);
export const getStringAsync = jest.fn().mockResolvedValue('');
export const hasStringAsync = jest.fn().mockResolvedValue(false);
