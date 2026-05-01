import React from 'react';
import { View } from 'react-native';

export const Slider = React.forwardRef(function MockSlider(
  props: Record<string, unknown>,
  ref: unknown,
) {
  return React.createElement(View, { ref, testID: 'awesome-slider', ...props } as Record<
    string,
    unknown
  >);
});

export const Bubble = React.forwardRef(function MockBubble(
  props: Record<string, unknown>,
  ref: unknown,
) {
  return React.createElement(View, { ref, testID: 'awesome-slider-bubble', ...props } as Record<
    string,
    unknown
  >);
});
