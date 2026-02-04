/**
 * Mock for expo-haptics module
 * Used by Jest via moduleNameMapper
 */

export const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
} as const;

export const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
} as const;

export const impactAsync = jest.fn().mockResolvedValue(undefined);
export const selectionAsync = jest.fn().mockResolvedValue(undefined);
export const notificationAsync = jest.fn().mockResolvedValue(undefined);

export default {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  selectionAsync,
  notificationAsync,
};
