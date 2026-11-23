const avatar = '/assets/avatars/web/witch.webp';
const buttonSample = `<button type="button" class="key">确认行动</button><button type="button" class="key secondary">返回</button><button type="button" class="key" disabled>不可操作</button>`;
const panelSample = `<section class="panel"><span class="panel-label">房间信息</span><h4>预女猎白</h4><p>12 人 · 标准规则</p><div class="progress"><span style="width:60%"></span></div></section>`;
const choiceSample = `<button type="button" class="tile" data-action="select-tile" aria-pressed="false"><b>经典板子 ›</b><small>12 人 · 点击选择</small></button>`;
const roleSample = `<div class="mini-role"><img src="${avatar}" alt=""><div><span class="tag gold">神职</span><b>女巫</b><small>解药与毒药，各一次</small></div></div><div class="mini-role-back"><span>✦</span><b>身份卡背</b></div>`;
const handSample = `<div class="hand"><button type="button" class="hand-card" data-action="select-hand" aria-pressed="false"><span>◇</span>查看身份</button><button type="button" class="hand-card" data-action="select-hand" aria-pressed="false"><span>✚</span>使用解药</button><button type="button" class="hand-card" data-action="select-hand" aria-pressed="false"><span>▤</span>玩法</button></div>`;
const fieldSample = `<label>房间号<input class="input" placeholder="输入房间号"></label><div class="row between"><span>声音</span><button class="switch" type="button" role="switch" aria-label="声音" aria-checked="true" data-action="switch"><span></span></button></div>`;
const seatSample = `<div class="seats"><button type="button" class="seat" data-action="seat" aria-pressed="false"><img src="/assets/avatars/web/seer.webp" alt=""><b>1 号 · 我</b><small>小雨</small></button><button type="button" class="seat" data-action="seat" aria-pressed="false"><img src="${avatar}" alt=""><b>2 号</b><small>阿杰</small></button></div>`;
const dialogSample = `<div class="sample-overlay"><div class="mini-dialog"><b>确认操作？</b><p>请确认后继续。</p><div class="row"><button type="button" class="key secondary" data-action="sample">取消</button><button type="button" class="key" data-action="sample">确认</button></div></div></div>`;
const tableSample = `<div class="table-wrap" role="region" aria-label="示例表格" tabindex="0"><table><thead><tr><th scope="col">用户</th><th scope="col">状态</th><th scope="col">最近活动</th></tr></thead><tbody><tr><th scope="row">小雨</th><td>正常</td><td>今天</td></tr><tr><th scope="row">阿杰</th><td>正常</td><td>昨天</td></tr></tbody></table></div>`;
const backgroundSample = `<div class="background-study"><span class="tag">预女猎白</span><h4>等待玩家入座</h4><p>用材质与物件关系营造桌游感。</p><button type="button" class="key" data-action="sample">创建房间</button></div>`;

const sections = [
  [
    '背景与材质',
    '保留蓝灰为主，同时比较暖色桌面与轻纹理。',
    backgroundSample,
    ['蓝灰桌面', '轻纹理桌面', '暖色桌面'],
  ],
  ['按钮', '点击感受按下、回弹和禁用状态。', buttonSample, ['桌游按键', '柔和立体', '深色描边']],
  ['信息面板', '静态信息像放在桌面上的底板。', panelSample, ['清爽纸板', '柔和悬浮', '暖色纸张']],
  [
    '可操作卡片',
    '点击可选择；选中状态会抬起并有标识。',
    choiceSample,
    ['清爽实体', '柔和悬浮', '深色描边'],
  ],
  [
    '角色身份卡',
    '以现有角色插画为中心，比较卡框。',
    roleSample,
    ['精致卡框', '柔和卡框', '暖色收藏卡'],
  ],
  [
    '游戏操作手牌',
    '点击手牌查看选中效果，比较扇形、并排和叠放。',
    handSample,
    ['扇形手牌', '并排手牌', '叠放手牌'],
  ],
  ['玩家座位', '座位作为可操作的桌面组件。', seatSample, ['实体座位', '柔和座位', '暖色座位']],
  [
    '输入框与开关',
    '输入框如嵌入面板的凹槽，开关可以点击。',
    fieldSample,
    ['清爽凹槽', '柔和表面', '暖色纸面'],
  ],
  [
    '弹窗与抽屉',
    '更高的实体面板，但不遮蔽信息层级。',
    dialogSample,
    ['实体面板', '柔和悬浮', '暖色纸板'],
  ],
  [
    '数据表格',
    '表格整体是面板，行保持紧凑，可横向滚动。',
    tableSample,
    ['清爽面板', '柔和面板', '暖色面板'],
  ],
];

export function galleryView() {
  return `<div class="gallery-heading"><span class="eyebrow">MATERIAL STUDIES</span><h3>先比较，再组合</h3><p class="muted">三种方向均可点击体验；标记「推荐」的是页面 mock 当前使用的方向。</p></div>${sections
    .map(([title, description, content, names]) => {
      const recommendedIndex = ['按钮', '信息面板', '弹窗与抽屉', '数据表格'].includes(title)
        ? 1
        : 0;
      return `<section class="gallery-section"><h3>${title}</h3><p>${description}</p><div class="gallery-grid">${names.map((name, index) => `<article class="sample ${index === 1 ? 'soft' : index === 2 ? (name.includes('暖') ? 'warm' : 'bold') : ''}"><div class="sample-title"><span>${name}</span>${index === recommendedIndex ? '<span class="tag">推荐</span>' : ''}</div><div class="sample-stage">${content}</div></article>`).join('')}</div></section>`;
    })
    .join('')}`;
}
