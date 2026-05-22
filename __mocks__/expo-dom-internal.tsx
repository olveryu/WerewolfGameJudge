/**
 * Mock for expo/dom/internal — used by babel-transformed 'use dom' components.
 * In tests, DOM components render as simple Views instead of WebView wrappers.
 */
import React from 'react';
import { View } from 'react-native';

export const WebView = React.forwardRef(function ExpoDomWebViewMock(
  props: Record<string, unknown>,
  ref: React.Ref<View>,
) {
  return <View ref={ref} testID="expo-dom-webview-mock" />;
});
