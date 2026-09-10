import { useWindowDimensions } from 'react-native';

const FASHION_COMPACT_LAYOUT_MAX_WIDTH = 390;
const FASHION_LARGE_TEXT_SCALE = 1.25;

/** Keep dense case controls readable on narrow phones and with large accessibility text. */
export function useFashionCompactLayout(): boolean {
  const { width, fontScale } = useWindowDimensions();
  return width <= FASHION_COMPACT_LAYOUT_MAX_WIDTH || fontScale >= FASHION_LARGE_TEXT_SCALE;
}
