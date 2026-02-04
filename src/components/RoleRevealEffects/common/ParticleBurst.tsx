/**
 * ParticleBurst - Burst of particles from a center point
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Particle, generateBurstParticles, type ParticleProps } from './Particle';

export interface ParticleBurstProps {
  /** Center X position */
  centerX: number;
  /** Center Y position */
  centerY: number;
  /** Particle color */
  color: string;
  /** Number of particles */
  count?: number;
  /** Spread radius */
  radius?: number;
  /** Particle size range */
  sizeRange?: [number, number];
  /** Duration range in ms */
  durationRange?: [number, number];
  /** Whether to show the burst */
  active: boolean;
  /** Callback when all particles complete */
  onComplete?: () => void;
}

interface ParticleWithId extends ParticleProps {
  id: string;
}

export const ParticleBurst: React.FC<ParticleBurstProps> = ({
  centerX,
  centerY,
  color,
  count = 12,
  radius = 100,
  sizeRange = [4, 8],
  durationRange = [600, 1000],
  active,
  onComplete,
}) => {
  const [particles] = React.useState<ParticleWithId[]>(() =>
    generateBurstParticles(count, centerX, centerY, radius, color, sizeRange, durationRange).map(
      (p, i) => ({ ...p, id: `particle-${i}-${Date.now()}` })
    )
  );

  const completedCount = React.useRef(0);

  const handleParticleComplete = React.useCallback(() => {
    completedCount.current += 1;
    if (completedCount.current >= particles.length) {
      onComplete?.();
    }
  }, [particles.length, onComplete]);

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((props) => (
        <Particle
          key={props.id}
          {...props}
          onComplete={handleParticleComplete}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
