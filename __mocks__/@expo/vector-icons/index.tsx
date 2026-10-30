/**
 * Mock for @expo/vector-icons in Jest tests.
 * Renders a simple Text element with the icon name as content for easy assertion.
 */
import type React from 'react';
import { Text } from 'react-native';

function createIconMock(familyName: string) {
  const IconMock: React.FC<{
    name: string;
    size?: number;
    color?: string;
    testID?: string;
    accessibilityLabel?: string;
  }> = ({ name, size, color, testID, accessibilityLabel }) => (
    <Text
      testID={testID ?? `${familyName}-icon-${name}`}
      accessibilityLabel={accessibilityLabel}
      style={{ fontSize: size, color }}
    >
      {name}
    </Text>
  );
  IconMock.displayName = familyName;
  return IconMock;
}

export const Ionicons = createIconMock('Ionicons');
export const MaterialIcons = createIconMock('MaterialIcons');
export const MaterialCommunityIcons = createIconMock('MaterialCommunityIcons');
export const FontAwesome = createIconMock('FontAwesome');
export const FontAwesome5 = createIconMock('FontAwesome5');
export const Feather = createIconMock('Feather');
export const AntDesign = createIconMock('AntDesign');
export const Entypo = createIconMock('Entypo');
export const Octicons = createIconMock('Octicons');
