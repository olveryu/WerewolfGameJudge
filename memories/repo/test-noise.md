# Test Noise Notes

- Local E2E can print `/telemetry/load-timing` 500 errors when the local Worker env lacks the
  `LOAD_TIMING.writeDataPoint` Analytics Engine binding. Treat it as environment noise unless the
  Playwright assertion fails.
- Root Jest can print `Cannot log after tests are done` from `ExpoModulesCoreJSLogger` while still
  exiting 0. The actionable signal is the final Jest exit code and failing suite list.
