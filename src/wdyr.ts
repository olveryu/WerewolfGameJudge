/**
 * why-did-you-render — detects unnecessary re-renders in development
 *
 * Must be imported at the very top of index.ts, before any React imports.
 * In production __DEV__ is false, no logic runs — zero overhead.
 *
 * Usage:
 * 1. Automatically tracks all React.memo / PureComponent globally (trackAllPureComponents enabled).
 * 2. For plain function components, mark the component after its definition:
 *    MyComponent.whyDidYouRender = true;
 *
 * @see https://github.com/welldone-software/why-did-you-render
 */
import type whyDidYouRenderFn from '@welldone-software/why-did-you-render';
import React from 'react';

if (__DEV__) {
  // Conditional require — production bundles strip this entire __DEV__ block.
  // Top-level `import` would ship the module in production.
  const whyDidYouRender =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@welldone-software/why-did-you-render') as typeof whyDidYouRenderFn;
  whyDidYouRender(React, {
    trackAllPureComponents: true,
  });
}
