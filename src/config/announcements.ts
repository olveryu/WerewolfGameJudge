/**
 * announcements — What's New 弹窗内容配置
 *
 * 每个版本号对应一条公告。用户打开 app 时，若 MMKV 存储的 lastSeenVersion
 * 不等于当前 APP_VERSION 且当前版本有对应条目，则弹出一次。
 * 新版本发布时在此添加条目即可。只写用户能感知到的变化。
 */

interface Announcement {
  title: string;
  items: string[];
}

/** 按版本号索引的公告内容。key 格式与 APP_VERSION 一致：`v{major}.{minor}.{patch}` */
export const ANNOUNCEMENTS: Record<string, Announcement> = {
  'v2.1.0': {
    title: 'v2.1.0 更新内容',
    items: [
      '网络不稳定时自动重试，减少操作失败',
      '断线后可手动点击重连',
      '微信小程序登录失败时显示明确提示',
      '退出登录等操作失败时显示错误提示',
    ],
  },
  'v2.0.1': {
    title: 'v2.0.1 更新内容',
    items: [
      '新增丘比特板子',
      '新增咒狐板子',
      '新增盗宝大师板子',
      '新增扭蛋抽奖功能',
      '修复安卓微信音频无法自动播放',
      '修复微信登录偶尔失败',
    ],
  },
};

/** 开发者微信号，在公告底部固定展示 */
export const DEVELOPER_WECHAT_ID = 'olveryu';
