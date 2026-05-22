import React from 'react';
import { View } from 'react-native';

const WebView = React.forwardRef(function WebView(props: Record<string, unknown>, ref: unknown) {
  return <View {...props} ref={ref as React.Ref<View>} />;
});

export { WebView };
export default WebView;
