/**
 * Mock for react-native-qrcode-svg module
 * Used by Jest via moduleNameMapper
 */
import React from 'react';
import { View } from 'react-native';

const QRCode = React.forwardRef(function QRCode(
  props: Record<string, unknown>,
  ref: React.Ref<{ toDataURL: (cb: (data: string) => void) => void }>,
) {
  React.useImperativeHandle(ref, () => ({
    toDataURL: (cb: (data: string) => void) => cb('mock-base64-data'),
  }));
  return <View testID="mock-qrcode" {...props} />;
});

export default QRCode;
