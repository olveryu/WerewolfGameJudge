/**
 * TarotDraw - Card Draw from Shuffling Deck Animation
 *
 * Features:
 * - Multiple cards in a deck, continuously shuffling/rotating
 * - Cards fly around in a circular pattern
 * - One card gets "drawn" - flies out and flips to reveal
 * - Mystical particle effects during shuffle
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Animated, StyleSheet, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors, borderRadius } from '../../../theme';
import type { RoleRevealEffectProps } from '../types';
import { ALIGNMENT_THEMES } from '../types';
import { CONFIG } from '../config';
import { canUseNativeDriver } from '../utils/platform';
import { triggerHaptic } from '../utils/haptics';
import { RoleCardContent } from '../common/RoleCardContent';
import { GlowBorder } from '../common/GlowBorder';
import type { RoleId } from '../../../models/roles';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Deck colors
const DECK_COLORS = {
  cardBack: '#1a1a2e',
  cardBackAccent: '#4a1a6b',
  cardBackPattern: '#6b3fa0',
  stardustGold: '#FFD700',
  particle: ['#FFD700', '#9370DB', '#00CED1', '#FF69B4'],
};

// Number of cards in the shuffling deck
const DECK_SIZE = 7;

// Stable IDs for deck cards
const DECK_CARD_IDS = ['deck-a', 'deck-b', 'deck-c', 'deck-d', 'deck-e', 'deck-f', 'deck-g'];
const DECK_FADE_IDS = ['fade-a', 'fade-b', 'fade-c', 'fade-d', 'fade-e', 'fade-f', 'fade-g'];

// Helper: Create orbit animation for a particle
function createParticleOrbitAnimation(
  p: ShuffleParticle,
  startAngle: number,
  radius: number,
  halfDuration: number,
): Animated.CompositeAnimation {
  return Animated.parallel([
    Animated.sequence([
      Animated.timing(p.x, {
        toValue: Math.cos(startAngle) * radius,
        duration: halfDuration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(p.x, {
        toValue: Math.cos(startAngle + Math.PI) * radius,
        duration: halfDuration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: canUseNativeDriver,
      }),
    ]),
    Animated.sequence([
      Animated.timing(p.y, {
        toValue: Math.sin(startAngle) * radius * 0.5,
        duration: halfDuration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(p.y, {
        toValue: Math.sin(startAngle + Math.PI) * radius * 0.5,
        duration: halfDuration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: canUseNativeDriver,
      }),
    ]),
    Animated.sequence([
      Animated.timing(p.opacity, {
        toValue: 0.8,
        duration: halfDuration,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(p.opacity, {
        toValue: 0.4,
        duration: halfDuration,
        useNativeDriver: canUseNativeDriver,
      }),
    ]),
    Animated.sequence([
      Animated.timing(p.scale, {
        toValue: 1.2,
        duration: halfDuration,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(p.scale, {
        toValue: 0.6,
        duration: halfDuration,
        useNativeDriver: canUseNativeDriver,
      }),
    ]),
  ]);
}

// Helper: Create card shuffle animation
function createCardShuffleAnimation(
  card: DeckCardAnim,
  startAngle: number,
  currentRotation: number,
  radius: number,
  duration: number,
): Animated.CompositeAnimation {
  const halfDuration = duration / 2;
  return Animated.parallel([
    Animated.sequence([
      Animated.timing(card.x, {
        toValue: Math.cos(startAngle) * radius,
        duration: halfDuration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(card.x, {
        toValue: Math.cos(startAngle + Math.PI) * radius,
        duration: halfDuration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: canUseNativeDriver,
      }),
    ]),
    Animated.sequence([
      Animated.timing(card.y, {
        toValue: Math.sin(startAngle) * radius * 0.4,
        duration: halfDuration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(card.y, {
        toValue: Math.sin(startAngle + Math.PI) * radius * 0.4,
        duration: halfDuration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: canUseNativeDriver,
      }),
    ]),
    Animated.timing(card.rotate, {
      toValue: currentRotation + 15,
      duration,
      easing: Easing.linear,
      useNativeDriver: canUseNativeDriver,
    }),
  ]);
}

// Helper: Start looping particle orbit animation
function startParticleOrbit(p: ShuffleParticle, radius: number, halfDuration: number): void {
  const animateOrbit = (startAngle: number) => {
    createParticleOrbitAnimation(p, startAngle, radius, halfDuration).start(() =>
      animateOrbit(startAngle + Math.PI),
    );
  };
  animateOrbit(p.baseAngle);
}

// Helper: Start looping card shuffle animation
function startCardShuffle(card: DeckCardAnim, radius: number, duration: number): void {
  const animateCard = (startAngle: number, currentRotation: number) => {
    createCardShuffleAnimation(card, startAngle, currentRotation, radius, duration).start(() =>
      animateCard(startAngle + Math.PI, currentRotation + 15),
    );
  };
  animateCard(card.baseAngle, 0);
}

// Deck card animation values
interface DeckCardAnim {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  baseAngle: number;
}

// Shuffle particle
interface ShuffleParticle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  color: string;
  baseAngle: number;
}

// Single deck card component (card back)
interface DeckCardViewProps {
  anim: DeckCardAnim;
  cardWidth: number;
  cardHeight: number;
  zIndex: number;
}

const DeckCardView: React.FC<DeckCardViewProps> = React.memo(
  ({ anim, cardWidth, cardHeight, zIndex }) => {
    const rotation = anim.rotate.interpolate({
      inputRange: [-180, 0, 180, 360],
      outputRange: ['-180deg', '0deg', '180deg', '360deg'],
    });

    return (
      <Animated.View
        style={[
          styles.deckCard,
          {
            width: cardWidth,
            height: cardHeight,
            zIndex,
            transform: [
              { translateX: anim.x },
              { translateY: anim.y },
              { rotate: rotation },
              { scale: anim.scale },
            ],
            opacity: anim.opacity,
          },
        ]}
      >
        <LinearGradient
          colors={[DECK_COLORS.cardBack, DECK_COLORS.cardBackAccent]}
          style={styles.cardBackGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Card back pattern */}
          <View style={styles.cardBackPattern}>
            <View style={[styles.patternCircle, styles.patternOuter]} />
            <View style={[styles.patternCircle, styles.patternMiddle]} />
            <View style={[styles.patternCircle, styles.patternInner]} />
            <View style={styles.patternStar} />
          </View>
        </LinearGradient>
      </Animated.View>
    );
  },
);
DeckCardView.displayName = 'DeckCardView';

export const TarotDraw: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'tarot-draw',
}) => {
  const colors = useColors();
  const theme = ALIGNMENT_THEMES[role.alignment];

  const [phase, setPhase] = useState<'shuffling' | 'drawing' | 'revealing' | 'revealed'>(
    'shuffling',
  );
  const [particles, setParticles] = useState<ShuffleParticle[]>([]);

  // Card dimensions
  const deckCardWidth = Math.min(160, SCREEN_WIDTH * 0.4);
  const deckCardHeight = deckCardWidth * 1.4;
  const revealCardWidth = Math.min(280, SCREEN_WIDTH * 0.75);
  const revealCardHeight = revealCardWidth * 1.4;

  // Deck cards animation values
  const deckCards = useMemo<DeckCardAnim[]>(() => {
    return Array.from({ length: DECK_SIZE }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rotate: new Animated.Value(i * 10 - 30),
      scale: new Animated.Value(0.9),
      opacity: new Animated.Value(1),
      baseAngle: (Math.PI * 2 * i) / DECK_SIZE,
    }));
  }, []);

  // The chosen card (will be drawn out)
  const chosenCard = useMemo(
    () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(50), // Start slightly lower
      rotate: new Animated.Value(0),
      scale: new Animated.Value(0.6),
      opacity: new Animated.Value(0),
      flip: new Animated.Value(0),
    }),
    [],
  );

  // Glow effect
  const glowOpacity = useMemo(() => new Animated.Value(0), []);
  const glowScale = useMemo(() => new Animated.Value(0.8), []);

  // Create shuffle particles
  const createParticles = useCallback((): ShuffleParticle[] => {
    const newParticles: ShuffleParticle[] = [];
    for (let i = 0; i < 12; i++) {
      newParticles.push({
        id: i,
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0),
        color: DECK_COLORS.particle[i % DECK_COLORS.particle.length],
        baseAngle: (Math.PI * 2 * i) / 12,
      });
    }
    setParticles(newParticles);
    return newParticles;
  }, []);

  // Animate particles in circular motion
  const animateParticles = useCallback((particleList: ShuffleParticle[]) => {
    particleList.forEach((p) => {
      const radius = 90 + Math.random() * 30;
      const duration = 1200 + Math.random() * 400;
      const halfDuration = duration / 2;
      startParticleOrbit(p, radius, halfDuration);
    });
  }, []);

  // Fade out particles
  const fadeOutParticles = useCallback((particleList: ShuffleParticle[]) => {
    particleList.forEach((p) => {
      Animated.timing(p.opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: canUseNativeDriver,
      }).start();
    });
  }, []);

  // Shuffle animation - cards orbit around center
  const startShuffleAnimation = useCallback(() => {
    deckCards.forEach((card) => {
      const radius = 50;
      const duration = 600 + Math.random() * 200;
      startCardShuffle(card, radius, duration);
    });
  }, [deckCards]);

  // Draw animation - one card flies out
  const startDrawAnimation = useCallback(() => {
    setPhase('drawing');
    if (enableHaptics) triggerHaptic('medium', true);

    // Fade deck cards
    deckCards.forEach((card) => {
      Animated.parallel([
        Animated.timing(card.opacity, {
          toValue: 0.2,
          duration: 500,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(card.scale, {
          toValue: 0.6,
          duration: 500,
          useNativeDriver: canUseNativeDriver,
        }),
      ]).start();
    });

    // Animate chosen card flying up
    Animated.sequence([
      // Appear
      Animated.parallel([
        Animated.timing(chosenCard.opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(chosenCard.scale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: canUseNativeDriver,
        }),
      ]),
      // Fly up
      Animated.parallel([
        Animated.timing(chosenCard.y, {
          toValue: -SCREEN_HEIGHT * 0.08,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(chosenCard.scale, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(chosenCard.rotate, {
          toValue: 3,
          duration: 700,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(glowScale, {
          toValue: 1.2,
          duration: 700,
          useNativeDriver: canUseNativeDriver,
        }),
      ]),
    ]).start(() => {
      // Start flip
      setPhase('revealing');
      if (enableHaptics) triggerHaptic('heavy', true);

      Animated.timing(chosenCard.flip, {
        toValue: 1,
        duration: 800,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: canUseNativeDriver,
      }).start(() => {
        setPhase('revealed');
        if (enableHaptics) triggerHaptic('heavy', true);
      });
    });
  }, [deckCards, chosenCard, glowOpacity, glowScale, enableHaptics]);

  // Handle reveal complete
  const handleRevealComplete = useCallback(() => {
    setTimeout(() => {
      onComplete();
    }, CONFIG.tarot?.revealHoldDuration ?? 1500);
  }, [onComplete]);

  // Main animation sequence
  useEffect(() => {
    if (reducedMotion) {
      chosenCard.opacity.setValue(1);
      chosenCard.scale.setValue(1);
      chosenCard.flip.setValue(1);
      chosenCard.y.setValue(-SCREEN_HEIGHT * 0.08);
      setPhase('revealed');
      return;
    }

    // Create and animate particles
    const particleList = createParticles();
    animateParticles(particleList);

    // Start shuffle
    startShuffleAnimation();
    if (enableHaptics) triggerHaptic('light', true);

    // After shuffle, draw a card
    const shuffleDuration = CONFIG.tarot?.shuffleDuration ?? 2000;
    const drawTimer = setTimeout(() => {
      fadeOutParticles(particleList);
      startDrawAnimation();
    }, shuffleDuration);

    return () => {
      clearTimeout(drawTimer);
    };
  }, [
    reducedMotion,
    enableHaptics,
    createParticles,
    animateParticles,
    fadeOutParticles,
    startShuffleAnimation,
    startDrawAnimation,
    chosenCard,
  ]);

  // Trigger complete when revealed
  useEffect(() => {
    if (phase === 'revealed') {
      handleRevealComplete();
    }
  }, [phase, handleRevealComplete]);

  // Flip interpolations
  const frontRotateY = chosenCard.flip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['180deg', '90deg', '0deg'],
  });

  const backRotateY = chosenCard.flip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '180deg'],
  });

  const frontOpacity = chosenCard.flip.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const backOpacity = chosenCard.flip.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  const chosenRotation = chosenCard.rotate.interpolate({
    inputRange: [-30, 0, 30],
    outputRange: ['-30deg', '0deg', '30deg'],
  });

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      testID={`${testIDPrefix}-container`}
    >
      {/* Background gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.9)', 'rgba(20,0,40,0.95)', 'rgba(0,0,0,0.9)']}
        style={StyleSheet.absoluteFill}
      />

      {/* Shuffle particles */}
      {particles.map((p) => (
        <Animated.View
          key={`particle-${p.id}`}
          style={[
            styles.particle,
            {
              backgroundColor: p.color,
              transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
              opacity: p.opacity,
            },
          ]}
        />
      ))}

      {/* Deck cards (shuffling) */}
      {phase === 'shuffling' &&
        deckCards.map((card, i) => (
          <DeckCardView
            key={DECK_CARD_IDS[i]}
            anim={card}
            cardWidth={deckCardWidth}
            cardHeight={deckCardHeight}
            zIndex={i}
          />
        ))}

      {/* Fading deck during draw/reveal */}
      {(phase === 'drawing' || phase === 'revealing' || phase === 'revealed') &&
        deckCards.map((card, i) => (
          <DeckCardView
            key={DECK_FADE_IDS[i]}
            anim={card}
            cardWidth={deckCardWidth}
            cardHeight={deckCardHeight}
            zIndex={i}
          />
        ))}

      {/* Glow behind chosen card */}
      {(phase === 'drawing' || phase === 'revealing' || phase === 'revealed') && (
        <Animated.View
          style={[
            styles.glowContainer,
            {
              transform: [{ translateY: chosenCard.y }, { scale: glowScale }],
              opacity: glowOpacity,
            },
          ]}
        >
          <LinearGradient
            colors={[theme.glowColor + '80', theme.primaryColor + '40', 'transparent']}
            style={[styles.glow, { width: revealCardWidth * 1.5, height: revealCardHeight * 1.5 }]}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>
      )}

      {/* The chosen card */}
      {(phase === 'drawing' || phase === 'revealing' || phase === 'revealed') && (
        <Animated.View
          style={[
            styles.chosenCardContainer,
            {
              transform: [
                { translateY: chosenCard.y },
                { rotate: chosenRotation },
                { scale: chosenCard.scale },
              ],
              opacity: chosenCard.opacity,
            },
          ]}
        >
          {/* Card back (before flip) */}
          <Animated.View
            style={[
              styles.cardFace,
              {
                width: revealCardWidth,
                height: revealCardHeight,
                borderRadius: borderRadius.medium,
                transform: [{ rotateY: backRotateY }],
                opacity: backOpacity,
              },
            ]}
          >
            <LinearGradient
              colors={[DECK_COLORS.cardBack, DECK_COLORS.cardBackAccent]}
              style={[styles.cardBackGradient, { borderRadius: borderRadius.medium }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardBackPattern}>
                <View style={[styles.patternCircle, styles.patternOuter]} />
                <View style={[styles.patternCircle, styles.patternMiddle]} />
                <View style={[styles.patternCircle, styles.patternInner]} />
                <View style={[styles.patternStar, { borderColor: DECK_COLORS.stardustGold }]} />
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Card front (role revealed) */}
          <Animated.View
            style={[
              styles.cardFace,
              styles.cardFront,
              {
                width: revealCardWidth,
                height: revealCardHeight,
                borderRadius: borderRadius.medium,
                transform: [{ rotateY: frontRotateY }],
                opacity: frontOpacity,
              },
            ]}
          >
            <RoleCardContent
              roleId={role.id as RoleId}
              width={revealCardWidth}
              height={revealCardHeight}
            />
          </Animated.View>

          {/* Glow border on reveal */}
          {phase === 'revealed' && (
            <GlowBorder
              width={revealCardWidth + 8}
              height={revealCardHeight + 8}
              color={theme.primaryColor}
              glowColor={theme.glowColor}
              borderWidth={3}
              borderRadius={borderRadius.medium + 4}
              animate={!reducedMotion}
              flashCount={3}
              flashDuration={200}
              onComplete={handleRevealComplete}
              style={styles.glowBorder}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  deckCard: {
    position: 'absolute',
    borderRadius: borderRadius.small,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  cardBackGradient: {
    flex: 1,
    borderRadius: borderRadius.small,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: DECK_COLORS.cardBackPattern,
  },
  cardBackPattern: {
    width: '80%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patternCircle: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: DECK_COLORS.cardBackPattern,
    borderRadius: 1000,
  },
  patternOuter: {
    width: '100%',
    aspectRatio: 1,
    opacity: 0.4,
  },
  patternMiddle: {
    width: '70%',
    aspectRatio: 1,
    opacity: 0.6,
  },
  patternInner: {
    width: '40%',
    aspectRatio: 1,
    opacity: 0.8,
  },
  patternStar: {
    width: 30,
    height: 30,
    borderWidth: 2,
    borderColor: DECK_COLORS.stardustGold,
    transform: [{ rotate: '45deg' }],
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  glowContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    borderRadius: 1000,
  },
  chosenCardContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardFace: {
    position: 'absolute',
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  cardFront: {
    // Additional styles for front
  },
  glowBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
});
