/**
 * 应用版本号配置
 *
 * 版本号从 package.json 读取，遵循 SemVer 规范
 * 使用 npm version patch/minor/major 更新版本
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageJson = require('../../package.json');

export const APP_VERSION = `v${packageJson.version}`;

/**
 * 获取完整版本号
 */
export function getVersionString(): string {
  return APP_VERSION;
}
