/**
 * Ambient module declarations for static assets.
 *
 * Metro bundler resolves `require('*.png')` etc. to a numeric asset ID at
 * build time. Without these declarations, TypeScript infers `any` from the
 * CommonJS `require()` call, which triggers `@typescript-eslint/no-unsafe-*`
 * rules. Declaring them as `number` matches Metro's runtime behavior.
 */

declare module '*.png' {
  const value: number;
  export default value;
}

declare module '*.webp' {
  const value: number;
  export default value;
}

declare module '*.jpg' {
  const value: number;
  export default value;
}

declare module '*.jpeg' {
  const value: number;
  export default value;
}

declare module '*.gif' {
  const value: number;
  export default value;
}

declare module '*.mp3' {
  const value: number;
  export default value;
}

declare module '*.wav' {
  const value: number;
  export default value;
}

declare module '*.m4a' {
  const value: number;
  export default value;
}
