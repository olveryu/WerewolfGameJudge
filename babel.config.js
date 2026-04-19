module.exports = function (api) {
  // Re-evaluate when NODE_ENV changes (dev ↔ production) so the Sentry
  // tree-shaking plugin is only applied in production builds.
  api.cache.using(() => process.env.NODE_ENV);

  const plugins = [];

  // Sentry tree-shaking: replace compile-time flags to dead-code-eliminate
  // debug logging, performance tracing, and Session Replay from the bundle.
  // @see https://docs.sentry.io/platforms/javascript/configuration/tree-shaking/
  if (process.env.NODE_ENV === 'production') {
    plugins.push([
      'transform-define',
      {
        // Remove verbose debug logging (~200KB)
        __SENTRY_DEBUG__: false,
        // Remove performance tracing code — no browserTracingIntegration used
        __SENTRY_TRACING__: false,
        // Remove Session Replay iframe/shadow DOM/worker code (~400KB)
        __RRWEB_EXCLUDE_IFRAME__: true,
        __RRWEB_EXCLUDE_SHADOW_DOM__: true,
        __SENTRY_EXCLUDE_REPLAY_WORKER__: true,
      },
    ]);
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
