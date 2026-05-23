/**
 * Module augmentation for react-native-web CSS animation/transition properties.
 *
 * react-native-web supports CSS transitions and animations via inline style,
 * but @types/react-native does not include these properties.
 * This augmentation adds them to ViewStyle and TextStyle so usage is type-safe
 * without any `as never` / `as unknown as ViewStyle` casts.
 *
 * Reference: https://necolas.github.io/react-native-web/docs/styling/#non-standard-properties
 */
import 'react-native';

declare module 'react-native' {
  interface ViewStyle {
    // CSS Transition
    transitionProperty?: string;
    transitionDuration?: string;
    transitionTimingFunction?: string;
    transitionDelay?: string;

    // CSS Animation
    animationName?: string;
    animationDuration?: string;
    animationTimingFunction?: string;
    animationDelay?: string;
    animationFillMode?: string;
    animationIterationCount?: number | string;
    animationPlayState?: string;
    animationDirection?: string;
  }

  interface TextStyle {
    // CSS Transition
    transitionProperty?: string;
    transitionDuration?: string;
    transitionTimingFunction?: string;
    transitionDelay?: string;

    // CSS Animation
    animationName?: string;
    animationDuration?: string;
    animationTimingFunction?: string;
    animationDelay?: string;
    animationFillMode?: string;
    animationIterationCount?: number | string;
    animationPlayState?: string;
    animationDirection?: string;
  }

  // Web pointer events — supported by react-native-web but not in RN core types
  interface ViewProps {
    onPointerDown?: (e: import('react').PointerEvent<Element>) => void;
    onPointerMove?: (e: import('react').PointerEvent<Element>) => void;
    onPointerUp?: (e: import('react').PointerEvent<Element>) => void;
    onPointerCancel?: (e: import('react').PointerEvent<Element>) => void;
  }
}
