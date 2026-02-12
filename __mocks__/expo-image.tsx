/**
 * Mock for expo-image module
 * Used by Jest via moduleNameMapper
 */
const React = require('react');

function MockImage(props: Record<string, unknown>) {
  return React.createElement('ExpoImage', props);
}

module.exports = {
  Image: MockImage,
};
