/**
 * Mock for expo-sharing module
 * Used by Jest via moduleNameMapper
 */
export const isAvailableAsync = jest.fn().mockResolvedValue(true);
export const shareAsync = jest.fn().mockResolvedValue(undefined);
export const getSharedPayloads = jest.fn().mockReturnValue([]);
export const clearSharedPayloads = jest.fn();
