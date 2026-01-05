import React, { useState } from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { generateAvatarUrl } from '../utils/avatar';

interface JdenticonProps {
  value: string;
  size: number;
}

// Generate a color from a string hash
const getColorFromSeed = (seed: string): string => {
  const colors = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', 
    '#3F51B5', '#2196F3', '#00BCD4', '#009688', 
    '#4CAF50', '#8BC34A', '#FF9800', '#FF5722'
  ];
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

/**
 * Modern avatar component using DiceBear API
 * Shows a colored fallback with initial while image loads
 */
export const Jdenticon: React.FC<JdenticonProps> = ({ value, size }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Request higher resolution for crisp display
  const avatarUrl = generateAvatarUrl(value, 200);
  const bgColor = getColorFromSeed(value);
  const initial = (value || '?')[0].toUpperCase();
  const borderRadius = size / 4;
  
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius, backgroundColor: bgColor }]}>
      {/* Fallback initial - always visible until image loads */}
      {(!imageLoaded || imageError) && (
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
      )}
      
      {/* Image overlay */}
      {!imageError && (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.image, { width: size, height: size, borderRadius }]}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initial: {
    color: '#FFFFFF',
    fontWeight: '700',
    position: 'absolute',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default Jdenticon;
