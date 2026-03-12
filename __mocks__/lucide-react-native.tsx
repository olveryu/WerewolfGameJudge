/**
 * Mock for lucide-react-native in Jest tests.
 * Each icon is a simple View with testID for assertions.
 */
import React from 'react';
import { View } from 'react-native';

function createIconMock(name: string) {
  const IconMock: React.FC<{ size?: number; color?: string; strokeWidth?: number }> = ({
    size,
    color,
  }) => (
    <View testID={`lucide-${name}`} style={{ width: size, height: size, borderColor: color }} />
  );
  IconMock.displayName = name;
  return IconMock;
}

export const Cat = createIconMock('Cat');
export const Dog = createIconMock('Dog');
export const Bird = createIconMock('Bird');
export const Fish = createIconMock('Fish');
export const Rabbit = createIconMock('Rabbit');
export const Squirrel = createIconMock('Squirrel');
export const Bug = createIconMock('Bug');
export const Turtle = createIconMock('Turtle');
export const Snail = createIconMock('Snail');
export const Leaf = createIconMock('Leaf');
export const TreePine = createIconMock('TreePine');
export const Flower2 = createIconMock('Flower2');
export const Mountain = createIconMock('Mountain');
export const Cloud = createIconMock('Cloud');
export const Flame = createIconMock('Flame');
export const Snowflake = createIconMock('Snowflake');
export const Moon = createIconMock('Moon');
export const Star = createIconMock('Star');
export const Compass = createIconMock('Compass');
export const Anchor = createIconMock('Anchor');
export const Gem = createIconMock('Gem');
export const Crown = createIconMock('Crown');
export const Feather = createIconMock('Feather');
export const Ghost = createIconMock('Ghost');
export const Rocket = createIconMock('Rocket');
export const Skull = createIconMock('Skull');
export const Wand = createIconMock('Wand');
export const Shield = createIconMock('Shield');
export const Swords = createIconMock('Swords');
export const Zap = createIconMock('Zap');
export const Heart = createIconMock('Heart');
export const Eye = createIconMock('Eye');
export const Music = createIconMock('Music');
export const Palette = createIconMock('Palette');
export const Dice5 = createIconMock('Dice5');
export const Cherry = createIconMock('Cherry');
export const Apple = createIconMock('Apple');
export const Citrus = createIconMock('Citrus');
export const Grape = createIconMock('Grape');
export const Banana = createIconMock('Banana');
export const Candy = createIconMock('Candy');
export const IceCreamCone = createIconMock('IceCreamCone');
export const Cake = createIconMock('Cake');
export const Pizza = createIconMock('Pizza');
export const Drumstick = createIconMock('Drumstick');
export const Footprints = createIconMock('Footprints');
export const PawPrint = createIconMock('PawPrint');
export const Clover = createIconMock('Clover');
export const Sparkles = createIconMock('Sparkles');
export const Rainbow = createIconMock('Rainbow');
