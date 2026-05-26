/**
 * announcements — What's New modal content config
 *
 * Each version maps to one announcement. On app launch, if MMKV-stored lastSeenVersion
 * does not equal current APP_VERSION and the current version has an entry, show once.
 * Add an entry here on each new release. Only describe user-visible changes.
 */

/** Single What's New announcement entry. */
interface Announcement {
  /** Modal title (e.g. "v2.5.0 更新内容") */
  title: string;
  /** Update item list; each is a one-sentence description of a user-visible change */
  items: string[];
}

/** Announcements keyed by version. Key format matches APP_VERSION: `v{major}.{minor}.{patch}` */
export const ANNOUNCEMENTS: Record<string, Announcement> = {
  'v2.5.0': {
    title: 'v2.5.0 更新内容',
    items: [
      '新增隐狼角色及隐狼乌鸦板子',
      '每日登录赠送 1 次金色扭蛋机会',
      '微信小程序登录体验全面优化',
      '修复头像框玩家座位高亮不显示',
      '弱网环境连接稳定性提升',
      '座位动画流畅度大幅优化',
    ],
  },
  'v2.4.0': {
    title: 'v2.4.0 更新内容',
    items: [
      '公告弹窗改版，新增板子推荐和反馈入口',
      '扭蛋奖励随机化，新增概率公示',
      '最近房间卡片 UI 焕新',
      '修复座位点击误触和音频播放稳定性',
      '动画流畅度优化',
    ],
  },
  'v2.3.0': {
    title: 'v2.3.0 更新内容',
    items: [
      '新增意见反馈入口，遇到问题可直接提交，开发者第一时间处理',
      '修复丘比特殉情链在特定板子中未正确触发的严重 Bug',
      '大幅优化错误提示，操作失败时给出具体原因而非笼统报错',
      '扭蛋系统稳定性加固，杜绝网络波动导致重复扣券',
      '全面重构底层通信架构，大幅提升流畅度和断线恢复速度',
      '音频初始化失败时自动提示并可手动恢复',
    ],
  },
  'v2.2.0': {
    title: 'v2.2.0 更新内容',
    items: [
      '新增角色图鉴 + 板子攻略，一站式查阅所有角色技能和板子策略',
      '新增 72 件外观装饰（头像框/座位装饰/座位宠物）+ 入场动画',
      '新增扭蛋概率公示，角色揭示特效可在资料卡预览',
      '优化国内访问速度，修复装饰品断线重连后未同步',
    ],
  },
  'v2.1.0': {
    title: 'v2.1.0 更新内容',
    items: [
      '网络不稳定时自动重试，减少操作失败',
      '断线后可手动点击重连',
      '微信小程序登录失败时显示明确提示',
    ],
  },
  'v2.0.0': {
    title: 'v2.0 更新内容',
    items: ['新增扭蛋抽奖 + 外观装饰系统', '支持微信小程序登录', '修复安卓微信音频无法自动播放'],
  },
  'v1.0.0': {
    title: 'v1.0 首发',
    items: [
      '支持 12 人标准局，含预女猎白守混血等经典角色',
      '语音播报自动裁判，无需人工主持',
      '支持自定义板子 + 预设模板一键开局',
      '微信扫码加入房间',
    ],
  },
};

// ── Board version mapping ────────────────────────────────────────────────────

/** Version when each board was first introduced. key = PresetTemplate.name */
export const BOARD_VERSION_MAP: Record<string, string> = {
  // v1.0.0 — initial 17 boards
  预女猎白: 'v1.0.0',
  狼美守卫: 'v1.0.0',
  狼王守卫: 'v1.0.0',
  白狼王守卫: 'v1.0.0',
  石像鬼守墓人: 'v1.0.0',
  噩梦之影守卫: 'v1.0.0',
  血月猎魔: 'v1.0.0',
  狼王摄梦人: 'v1.0.0',
  狼王魔术师: 'v1.0.0',
  机械狼人通灵师: 'v1.0.0',
  恶灵骑士: 'v1.0.0',
  // v1.2.0
  纯白夜影: 'v1.2.0',
  灯影预言家: 'v1.2.0',
  假面舞会: 'v1.2.0',
  吹笛者: 'v1.2.0',
  预女猎白混: 'v1.0.0',
  预女猎白野: 'v1.2.0',
  // v2.0.0
  盗宝大师: 'v2.0.0',
  盗贼丘比特: 'v2.0.0',
  咒狐乌鸦: 'v2.0.0',
  影子复仇者: 'v2.0.0',
  // v2.1.0
  唯邻是从: 'v2.1.0',
  孤注一掷: 'v2.1.0',
  // v2.2.0
  永序之轮: 'v2.2.0',
  // v2.5.0
  隐狼乌鸦: 'v2.5.0',
};

/** Board versions in descending order (latest first), for grouped display */
export const BOARD_VERSIONS_DESC = [
  'v2.5.0',
  'v2.2.0',
  'v2.1.0',
  'v2.0.0',
  'v1.2.0',
  'v1.0.0',
] as const;

/** Developer WeChat ID, shown fixed at announcement footer */
export const DEVELOPER_WECHAT_ID = 'olveryu';

/** All versions in descending order (latest first), for AnnouncementModal paging */
export const ANNOUNCEMENT_VERSIONS = Object.keys(ANNOUNCEMENTS);
