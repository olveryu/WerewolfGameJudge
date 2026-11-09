/** useKeyboardHeight - the on-screen keyboard height from `visualViewport`; 0 when hidden. */

import { useEffect, useState } from 'react';

/** Returns the current keyboard height (px); 0 when not displayed. */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    // Without visualViewport (older shells, jsdom) the keyboard height stays 0.
    if (!viewport) return;

    const initialHeight = window.innerHeight;
    const handleChange = () => {
      const kbHeight = initialHeight - viewport.height - viewport.offsetTop;
      setKeyboardHeight(Math.max(0, kbHeight));
    };

    viewport.addEventListener('resize', handleChange);
    viewport.addEventListener('scroll', handleChange);
    return () => {
      viewport.removeEventListener('resize', handleChange);
      viewport.removeEventListener('scroll', handleChange);
    };
  }, []);

  return keyboardHeight;
}
