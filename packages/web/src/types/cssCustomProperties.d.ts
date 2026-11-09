import 'react';

declare module 'react' {
  /** CSS custom properties (`--name`) set from components, e.g. a measured size. */
  interface CSSProperties {
    [customProperty: `--${string}`]: string | number | undefined;
  }
}
