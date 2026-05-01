/**
 * Mock for expo-image module
 * Used by Jest via moduleNameMapper
 */
import React from 'react';

function MockImage(props: Record<string, unknown>) {
  return React.createElement('ExpoImage', props);
}

export const Image = MockImage;
