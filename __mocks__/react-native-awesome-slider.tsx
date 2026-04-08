const React = require('react');
const { View } = require('react-native');

const Slider = React.forwardRef(function MockSlider(props: Record<string, unknown>, ref: unknown) {
  return React.createElement(View, { ref, testID: 'awesome-slider', ...props });
});

module.exports = {
  Slider,
  Bubble: React.forwardRef(function MockBubble(props: Record<string, unknown>, ref: unknown) {
    return React.createElement(View, { ref, testID: 'awesome-slider-bubble', ...props });
  }),
};
