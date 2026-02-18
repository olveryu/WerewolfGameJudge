/**
 * version - 应用版本号配置
 *
 * 版本号从 package.json 读取，遵循 SemVer 规范。
 * 使用 npm version patch/minor/major 更新版本，导出 APP_VERSION / getFullVersion。
 * 纯配置模块，不包含业务逻辑或副作用。
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('../../package.json');

export const APP_VERSION = `v${packageJson.version}`;
