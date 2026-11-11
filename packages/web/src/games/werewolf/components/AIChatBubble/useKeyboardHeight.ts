/** Measures keyboard overlap not already handled by a shrinking layout viewport. */

import { useEffect, useState } from 'react';

/** Returns the bottom viewport overlap (px); 0 when the layout already fits. */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    // Without visualViewport (older shells, jsdom) the keyboard height stays 0.
    if (!viewport) return;

    const handleChange = () => {
      const kbHeight = window.innerHeight - viewport.height - viewport.offsetTop;
      setKeyboardHeight(Math.max(0, kbHeight));
    };

    handleChange();
    window.addEventListener('resize', handleChange);
    viewport.addEventListener('resize', handleChange);
    viewport.addEventListener('scroll', handleChange);
    return () => {
      window.removeEventListener('resize', handleChange);
      viewport.removeEventListener('resize', handleChange);
      viewport.removeEventListener('scroll', handleChange);
    };
  }, []);

  return keyboardHeight;
}
