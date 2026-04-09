import React from 'react';
import { View } from 'react-native';

/** Stub insets — zero on all sides (no safe area in test environment). */
const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Mock SafeAreaView preserves testID, style, and edges props so
 * `waitForRoomScreen()` (and similar) can locate the component by testID.
 */
export const SafeAreaView = ({
  children,
  testID,
  style,
  ...rest
}: {
  children?: React.ReactNode;
  testID?: string;
  style?: Record<string, unknown>;
  edges?: string[];
  [key: string]: unknown;
}) => React.createElement(View, { testID, style, ...rest }, children);

export const SafeAreaProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export const useSafeAreaInsets = () => ZERO_INSETS;

export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 375, height: 812 });
