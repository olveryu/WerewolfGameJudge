/**
 * version - app version configuration
 *
 * Version is read from package.json and follows SemVer.
 * Use npm version patch/minor/major to bump the version; exports APP_VERSION / getFullVersion.
 * Pure config module — no business logic or side effects.
 */

import packageJson from '../../package.json';

/** Current app version (with `v` prefix, e.g. `v2.5.0`), read from package.json. */
export const APP_VERSION = `v${packageJson.version}`;
