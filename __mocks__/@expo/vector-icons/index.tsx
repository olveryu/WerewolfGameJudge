/**
 * Mock for @expo/vector-icons in Jest tests.
 * Renders a simple Text element with the icon name as content for easy assertion.
 */
import React from 'react';
import { Text } from 'react-native';

function createIconMock(familyName: string) {
  const IconMock: React.FC<{ name: string; size?: number; color?: string }> = ({
    name,
    size,
    color,
  }) => (
    <Text testID={`${familyName}-icon-${name}`} style={{ fontSize: size, color }}>
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
