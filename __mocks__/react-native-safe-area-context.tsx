import React from 'react';
import { View } from 'react-native';
import type {
  EdgeInsets,
  Metrics,
  Rect,
  SafeAreaProviderProps,
  SafeAreaViewProps,
} from 'react-native-safe-area-context';

const MOCK_INITIAL_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

export const initialWindowMetrics = MOCK_INITIAL_METRICS;
export const initialWindowSafeAreaInsets = MOCK_INITIAL_METRICS.insets;
export const SafeAreaInsetsContext = React.createContext<EdgeInsets | null>(null);
export const SafeAreaFrameContext = React.createContext<Rect | null>(null);
export const SafeAreaContext = SafeAreaInsetsContext;
export const SafeAreaConsumer = SafeAreaInsetsContext.Consumer;

/**
 * Mock SafeAreaView preserves testID, style, and edges props so
 * `waitForRoomScreen()` (and similar) can locate the component by testID.
 */
export const SafeAreaView = ({
  children,
  edges: _edges,
  mode: _mode,
  ...rest
}: SafeAreaViewProps) => React.createElement(View, rest, children);

export const SafeAreaProvider = ({ children, initialMetrics }: SafeAreaProviderProps) => (
  <SafeAreaFrameContext.Provider value={initialMetrics?.frame ?? MOCK_INITIAL_METRICS.frame}>
    <SafeAreaInsetsContext.Provider value={initialMetrics?.insets ?? MOCK_INITIAL_METRICS.insets}>
      {children}
    </SafeAreaInsetsContext.Provider>
  </SafeAreaFrameContext.Provider>
);

export const useSafeAreaInsets = () =>
  React.useContext(SafeAreaInsetsContext) ?? MOCK_INITIAL_METRICS.insets;

export const useSafeAreaFrame = () =>
  React.useContext(SafeAreaFrameContext) ?? MOCK_INITIAL_METRICS.frame;
