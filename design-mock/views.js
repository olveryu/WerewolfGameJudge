import { adminPages, games, productPages } from './data.js';

const avatar = (name) => `/assets/avatars/web/${name}.webp`;
const art = (game) => `/packages/web/src/assets/game-art/${game.id}.webp`;
const icons = ['wolf', 'witch', 'seer', 'hunter', 'guard', 'villager'];
const key = (label, variant = '', action = '') =>
  `<button type="button" class="key ${variant}" ${action ? `data-action="${action}"` : ''}>${label}</button>`;
const panel = (content, extra = '') => `<section class="panel ${extra}">${content}</section>`;
const header = (title, subtitle = '') =>
  `<header class="screen-head"><button class="icon-btn" type="button" data-page="home" aria-label="返回首页">‹</button><div><h3>${title}</h3>${subtitle ? `<small>${subtitle}</small>` : ''}</div><button class="icon-btn" type="button" data-action="menu" aria-label="更多操作">⋯</button></header>`;
const screen = (title, body, subtitle = '') =>
  `<div class="screen">${header(title, subtitle)}<div class="screen-body">${body}</div><footer class="screen-footer">视觉方案 · 模拟数据 · 不会执行真实操作</footer></div>`;
const tile = (title, subtitle, page, extra = '') =>
  `<button type="button" class="tile ${extra}" data-page="${page}"><b>${title}</b><small>${subtitle}</small></button>`;
const image = (url, alt = '') => `<img src="${url}" alt="${alt}" loading="lazy">`;
const card = (game = games[0]) =>
  `<div class="role-card"><div class="role-card-inner"><div class="role-card-art">${image(avatar(game.avatar), '')}</div><div class="role-card-copy"><span class="tag gold">${game.team}</span><p><b>${game.role}</b></p><p>${game.description}</p></div></div></div>`;
const cardBack = () =>
  `<div class="role-card role-back"><div class="role-back-inner"><span>✦</span><strong>身份卡</strong><small>仅自己可见</small></div></div>`;
const hand = (game = games[0]) =>
  `<div class="hand">${game.actions.map((action, index) => `<button class="hand-card" type="button" aria-pressed="false" data-action="select-hand"><span aria-hidden="true">${game.icons[index]}</span>${action}</button>`).join('')}</div>`;
const seatBoard = (count = 9, lobby = false) =>
  `<div class="seats">${Array.from({ length: count }, (_, index) => `<button type="button" class="seat" data-action="seat" aria-pressed="false">${lobby && index >= 2 ? '<span aria-hidden="true">＋</span>' : image(avatar(icons[index % icons.length]), '')}<b>${index + 1} 号${index === 0 ? ' · 我' : ''}</b><small>${lobby && index >= 2 ? '空座位' : ['小雨', '阿杰', '阿云', '小林', '阿青', '小白'][index % 6]}</small></button>`).join('')}</div>`;
const matchCard = (name, symbols) =>
  `<div class="match-card" role="group" aria-label="${name}">${symbols.map(([symbol, label]) => `<button type="button" data-action="sample" aria-label="${name}：${label}">${symbol}</button>`).join('')}</div>`;
const rows = (items) =>
  items
    .map(
      ([name, value]) =>
        `<div class="list-row"><b>${name}</b><span class="muted">${value} ›</span></div>`,
    )
    .join('');

function gameArt(game) {
  return `<img class="game-art" src="${art(game)}" alt="" loading="lazy">`;
}

function home() {
  return screen(
    '狼人面杀电子裁判助手',
    `
    <button class="tile primary" type="button" data-page="games"><b>创建房间 ›</b><small>9 款游戏 · 点开挑一款</small><span class="art-strip">${games
      .slice(0, 7)
      .map((game) => image(art(game)))
      .join('')}</span></button>
    <div class="grid-two">${tile('↪ 进入房间', '输入房间号', 'dialog')}${tile('◷ 最近房间', '查看最近的对局', 'room-werewolf')}</div>
    ${tile('♧ 扭蛋抽奖 ›', '用抽奖券解锁头像、头像框、装饰', 'gacha')}
    ${panel(`<div class="row"><img src="${avatar('witch')}" alt="" width="68" height="68"><div><span class="tag">今日角色</span><h4>女巫 <span class="tag gold">神职</span></h4><p>拥有一瓶解药和一瓶毒药，每瓶药限用一次。</p></div></div><div class="row between"><button class="link-button" data-action="sample" type="button">↻ 换一个</button><button class="link-button" data-page="role-werewolf" type="button">详情 ›</button></div>`)}
    ${tile('♧ 公告与反馈 ›', '查看更新 · 提交建议', 'dialog')}`,
  );
}

function gamePicker() {
  return screen(
    '选择游戏',
    `<div><span class="panel-label">GAME LIBRARY</span><h3>今天玩什么？</h3><p class="muted">选择游戏，创建属于你们的房间</p></div><div class="grid-two">${games.map((game) => `<button type="button" class="tile game-tile" data-page="config-${game.id}">${gameArt(game)}<span>${game.name} ›</span></button>`).join('')}</div>`,
  );
}

function stageContent(game) {
  if (game.id === 'drawguess' || game.id === 'pictionary') {
    return panel(
      `<div class="row between"><h4>画板</h4><span class="tag">01:24</span></div><div class="canvas-preview" aria-label="模拟画板"><span>✎</span><p>绘画区域</p></div>${game.id === 'drawguess' ? `<label>猜测词语<input class="input" placeholder="输入你的猜测"></label>${key('发送猜测', '', 'sample')}` : `<div class="row between"><div class="swatches"><i></i><i></i><i></i><i></i></div>${key('完成画作', '', 'sample')}</div>`}`,
    );
  }
  if (game.id === 'spotmatch') {
    return panel(
      `<div class="row between"><h4>中央牌</h4><span class="tag">剩余 5 张</span></div><div class="match-cards">${matchCard(
        '中央牌',
        [
          ['☀', '太阳'],
          ['✿', '花'],
          ['♣', '梅花'],
          ['✦', '闪光'],
          ['☾', '月亮'],
          ['✈', '飞机'],
          ['♥', '爱心'],
          ['⚑', '旗帜'],
        ],
      )}${matchCard('我的牌', [
        ['☂', '雨伞'],
        ['♞', '马'],
        ['☁', '云'],
        ['✿', '花'],
        ['♬', '音符'],
        ['◆', '菱形'],
        ['⚓', '船锚'],
        ['★', '星星'],
      ])}</div><p>点击任一张牌上的共同图案</p>`,
    );
  }
  if (game.id === 'storyrelay')
    return panel(
      `<span class="panel-label">故事接龙</span><h4>一个下雨的晚上</h4><p>大家在老车站等最后一班车，突然听到远处传来一阵奇怪的声音……</p><label>接下来会发生什么？<textarea class="input" rows="3" placeholder="写下你的故事"></textarea></label><div class="spaced">${key('提交故事', '', 'sample')}</div>`,
    );
  if (game.id === 'fibking')
    return panel(
      `<span class="panel-label">本轮词语</span><h4 class="big-word">沆瀣一气</h4><p>请轮流口头描述词语，大聪明听取描述后选人。</p>${key('查看身份', 'secondary', 'role')}`,
    );
  if (game.id === 'undercover')
    return panel(
      `<span class="panel-label">你的词语</span><h4 class="big-word">咖啡</h4><p>请轮流描述词语，在线下投票，再由房主揭晓出局玩家。</p>${key('查看词卡', 'secondary', 'role')}`,
    );
  if (game.id === 'avalon')
    return panel(
      `<div class="row between"><h4>任务进度</h4><span class="tag">第 1 轮</span></div><div class="track"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div><p>队长正在选择出征队员</p>`,
    );
  if (game.id === 'secrethitler')
    return panel(
      `<div class="row between"><h4>政策进度</h4><span class="tag">政府选举</span></div><p>自由派政策</p><div class="track blue"><span>✓</span><span>2</span><span>3</span><span>4</span><span>5</span></div><p>法西斯政策</p><div class="track red"><span>✓</span><span>2</span><span>3</span><span>4</span><span>5</span></div>`,
    );
  return panel(
    `<div class="row between"><h4>预女猎白</h4><span class="tag">12 人</span></div><p>狼人 × 4 · 村民 × 4</p><p>预言家 · 女巫 · 猎人 · 愚者</p>`,
  );
}

function secondaryStage(game) {
  if (game.id === 'drawguess')
    return panel(
      `<span class="panel-label">画手视角</span><h4>选择题目后开始作画</h4><p>题目仅画手可见。</p><div class="canvas-preview" aria-label="模拟画板"><span>✎</span><p>绘画区域</p></div><div class="swatches"><i></i><i></i><i></i><i></i></div>`,
    );
  if (game.id === 'pictionary')
    return panel(
      `<span class="panel-label">第 1 棒</span><h4>各自出题</h4><p>写一个题目，交给下一位玩家作画。</p><label>开场题目<input class="input" placeholder="输入题目"></label><div class="spaced">${key('准备好了', '', 'sample')}</div>`,
    );
  if (game.id === 'storyrelay')
    return panel(
      `<span class="panel-label">故事揭晓</span><h4>一个下雨的晚上</h4><p>大家在老车站等最后一班车……</p><p>远处的声音越来越近，原来是一只迷路的小猫。</p><div class="row">${key('上一段', 'secondary', 'sample')}${key('下一段', '', 'sample')}</div>`,
    );
  if (game.id === 'spotmatch')
    return `${stageContent(game)}${panel('<span class="tag green">匹配成功</span><h4>小雨找到共同图案</h4><p>示例反馈：公共牌即将更新。</p>')}`;
  return `${panel(`<div class="row between"><h4>你的身份</h4><span class="tag gold">仅自己可见</span></div><p>正面与卡背的静态设计对比。</p>`)}${card(game)}${cardBack()}`;
}

function endStage(game) {
  const result = {
    drawguess: ['总分排名', '小雨 · 180 分', '阿杰 · 140 分', '阿云 · 120 分'],
    spotmatch: ['本局排名', '小雨 · 出完手牌', '阿杰 · 剩余 2 张', '阿云 · 剩余 4 张'],
    pictionary: ['接龙揭晓', '第 1 本 · 开场题目', '第 2 棒 · 画作', '第 3 棒 · 猜词'],
    storyrelay: ['故事揭晓', '第一段 · 开头', '第二段 · 续写', '第三段 · 续写'],
    avalon: ['任务结果', '第 1 轮 · 成功', '第 2 轮 · 成功', '第 3 轮 · 成功'],
    secrethitler: ['对局结果', '自由派政策 · 5', '法西斯政策 · 2', '自由派获胜'],
    fibking: ['答案揭晓', '本轮词语 · 沆瀣一气', '大聪明 · 1 号', '老实人 · 2 号'],
    undercover: ['对局结果', '平民词语 · 咖啡', '卧底词语 · 奶茶', '身份已揭晓'],
    werewolf: ['对局结果', '狼人阵营', '神职阵营', '村民阵营'],
  }[game.id];
  return panel(
    `<span class="tag green">本局结束</span><h4>${result[0]}</h4><p>以下为示例结果。</p>${rows(result.slice(1).map((text) => [text, '']))}<div class="row spaced">${key('查看详情', 'secondary', 'sample')}${key('再来一局', '', 'sample')}</div>`,
  );
}

function room(game, state = 'playing') {
  const stage =
    state === 'lobby'
      ? `${panel(`<div class="row between"><div><span class="panel-label">本局配置</span><h4>${game.name} · ${game.players} 人</h4><p>等待玩家加入，还差 ${game.players - 2} 人</p></div><span class="tag">待开局</span></div>`)}${panel(seatBoard(game.players, true))}<button type="button" class="key" disabled>等待坐满后开始</button>`
      : state === 'identity'
        ? secondaryStage(game)
        : state === 'ended'
          ? endStage(game)
          : `${panel(`<div class="row between"><div><span class="panel-label">当前进度</span><h4>${game.phase}</h4></div><span class="tag green">进行中</span></div><p>${game.hint}</p>`)}${stageContent(game)}${game.id === 'drawguess' || game.id === 'pictionary' || game.id === 'spotmatch' ? '' : panel(`<div class="row between"><h4>座位</h4><span class="muted">玩家 ${game.players} / ${game.players}</span></div>${seatBoard(game.players)}`)}${panel(`<div class="row between"><h4>我的操作</h4><span class="muted">点击手牌操作</span></div>${hand(game)}`)}`;
  const secondaryLabel =
    {
      drawguess: '画手视角',
      pictionary: '开场出题',
      storyrelay: '故事揭晓',
      spotmatch: '匹配反馈',
    }[game.id] || '身份卡';
  const select = `<div class="state-picker"><label for="room-state">预览状态</label><select id="room-state"><option value="lobby" ${state === 'lobby' ? 'selected' : ''}>等待开局</option><option value="identity" ${state === 'identity' ? 'selected' : ''}>${secondaryLabel}</option><option value="playing" ${state === 'playing' ? 'selected' : ''}>游戏进行中</option><option value="ended" ${state === 'ended' ? 'selected' : ''}>本局结束</option></select></div>`;
  return screen(game.name, `${select}${stage}`, '房间 ABCD · 模拟房间');
}

function config(game) {
  const gameSettings = {
    avalon: [
      ['组队投票', '公投'],
      ['最多组队次数', '5 次'],
    ],
    fibking: [],
    undercover: [
      ['白板', '关闭'],
      ['词语分类', '全部分类'],
    ],
    drawguess: [],
    pictionary: [
      ['绘画时间', '120 秒'],
      ['文字作答时间', '45 秒'],
      ['每棒间隔', '5 秒'],
      ['揭晓后停留', '5 秒'],
    ],
    storyrelay: [
      ['写作时间', '90 秒'],
      ['每棒间隔', '3 秒'],
      ['每段停留', '5 秒'],
    ],
    spotmatch: [['每人牌数', '8 张']],
    secrethitler: [['投票方式', '公投']],
  };
  return screen(
    `${game.name} · 游戏设置`,
    `${panel(
      `<span class="panel-label">创建房间</span><h4>选择游戏配置</h4><p>以下为默认配置的视觉示意。</p>${rows(
        [['玩家人数', `${game.players} 人`], ...(gameSettings[game.id] || [])],
      )}`,
    )}${
      game.id === 'werewolf'
        ? panel(
            `<div class="row between"><h4>选择板子</h4><button type="button" class="link-button" data-page="boards">查看全部 ›</button></div><div class="grid-two"><button type="button" class="tile" data-action="select-tile" aria-pressed="true"><b>经典配置 ✓</b><small>适合熟悉规则的玩家</small></button><button type="button" class="tile" data-action="select-tile" aria-pressed="false"><b>自定义</b><small>选择角色和规则</small></button></div>`,
          )
        : game.id === 'avalon'
          ? panel(`<h4>人数即板子</h4><p>5–10 人各对应一张固定板子。</p>`)
          : ''
    }${key('创建房间', '', `open-room-${game.id}`)}${key('查看玩法', 'secondary', `open-guide-${game.id}`)}`,
  );
}

function guide(game) {
  const flows = {
    werewolf: [
      ['配置板子', '分配角色并查看身份'],
      ['天黑行动', '依次进行夜间行动'],
      ['白天讨论', '发言、投票并结算'],
    ],
    avalon: [
      ['查看身份', '了解自己的身份与可见信息'],
      ['组队与投票', '队长提名队员，全员投票'],
      ['执行任务', '出征队员秘密出牌'],
    ],
    fibking: [
      ['查看身份', '查看词语和身份信息'],
      ['依次描述', '口头解释词语'],
      ['大聪明选人', '房主代为点选并揭晓'],
    ],
    undercover: [
      ['确认词卡', '查看自己的词语'],
      ['描述与投票', '线下描述并投票'],
      ['揭晓出局', '房主确认被投出的玩家'],
    ],
    drawguess: [
      ['画手选词', '从候选词中选择'],
      ['作画与猜词', '其他玩家在聊天框猜词'],
      ['终局排名', '按总分排名'],
    ],
    pictionary: [
      ['各自出题', '写下开场题目'],
      ['文字与绘画交替', '只看紧邻的上一棒'],
      ['一起揭晓', '回放每条接龙'],
    ],
    storyrelay: [
      ['各写开头', '写下自己的第一段'],
      ['轮流续写', '只看紧邻的上一段'],
      ['一起揭晓', '回看完整故事'],
    ],
    spotmatch: [
      ['坐满开局', '每人领取手牌'],
      ['寻找共同图案', '点击公共牌或手牌'],
      ['结束比赛', '先出完手牌者获胜'],
    ],
    secrethitler: [
      ['查看身份', '了解自己的阵营'],
      ['选举与立法', '提名、投票并秘密施行政策'],
      ['阵营目标', '按政策轨道或特殊条件决胜'],
    ],
  };
  return screen(
    `${game.name} · 玩法`,
    `${panel(`<span class="panel-label">GAME GUIDE</span><h4>游戏介绍</h4><p>${game.description}</p>`)}${panel(
      `<h4>游戏流程</h4>${rows(flows[game.id])}`,
    )}${key('前往游戏设置', '', `open-config-${game.id}`)}`,
  );
}

function boards() {
  return screen(
    '选择板子',
    `${panel(`<span class="panel-label">PRESET BOARDS</span><h4>选择适合的对局</h4><p>选择预设或按你的喜好配置。</p>`)}${['预女猎白', '守卫板子', '狼王板子', '自定义板子'].map((name) => tile(name, '配置示意', 'config-werewolf')).join('')}`,
  );
}

function product(id) {
  if (id === 'home') return home();
  if (id === 'games') return gamePicker();
  if (id === 'boards') return boards();
  if (id === 'dialog')
    return screen(
      '弹窗与抽屉',
      `${panel(`<h4>弹窗预览</h4><p>实体面板浮于页面之上，保留清楚的操作层级。</p><div class="row">${key('打开弹窗', '', 'dialog')}${key('打开抽屉', 'secondary', 'sheet')}</div>`)}${panel(`<h4>常见状态</h4><p>确认 · 提示 · 错误 · 不可操作</p><div class="row">${key('确认')}${key('取消', 'secondary')}<button class="key" type="button" disabled>不可操作</button></div>`)}`,
    );
  if (id === 'error')
    return screen(
      '页面暂时不可用',
      panel(
        `<h4>连接遇到问题</h4><p>请检查网络连接，然后重试。</p>${key('重试', '', 'sample')} ${key('返回首页', 'secondary', 'home')}`,
      ),
    );
  if (id === 'settings')
    return screen(
      '设置',
      `${panel(`<div class="row"><img src="${avatar('witch')}" alt="" width="64" height="64"><div><h4>小雨</h4><p>已注册用户 · 等级 12</p></div></div>`)}${panel(
        rows([
          ['选择形象', '头像与装扮'],
          ['我的收藏', '查看已解锁'],
          ['音乐设置', '背景音乐与音效'],
          ['账户设置', '昵称与密码'],
        ]),
      )}<div class="grid-two">${tile('选择形象', '头像与装扮', 'appearance')}${tile('我的收藏', '查看已解锁', 'unlocks')}${tile('音乐设置', '背景音乐与音效', 'music')}${tile('扭蛋抽奖', '解锁新藏品', 'gacha')}</div>`,
    );
  if (id === 'music')
    return screen(
      '音乐设置',
      `${panel(
        `<h4>背景音乐</h4><label>背景音乐音量 <input type="range" min="0" max="100" value="60"></label>${rows(
          [
            ['随机播放', '已开启'],
            ['试听背景音乐', '播放'],
          ],
        )}`,
      )}${panel(`<h4>游戏音效</h4><label>游戏音效音量 <input type="range" min="0" max="100" value="75"></label><p>游戏中的提示和语音。</p>`)}`,
    );
  if (id === 'appearance' || id === 'unlocks' || id === 'shards') {
    const title = id === 'appearance' ? '选择形象' : id === 'unlocks' ? '我的收藏' : '碎片兑换';
    return screen(
      title,
      `${panel(`<div class="row between"><div><h4>${title}</h4><p>头像 · 头像框 · 装饰</p></div><span class="tag gold">已收集 28 / 72</span></div><div class="progress"><span style="width:39%"></span></div>`)}<div class="collection-grid">${icons.map((icon, index) => `<button type="button" class="collection-card" data-action="select-tile" aria-pressed="${index === 0}">${image(avatar(icon))}<b>${['狼人', '女巫', '预言家', '猎人', '守卫', '村民'][index]}</b><small>${index < 3 ? '已拥有' : '未解锁'}</small></button>`).join('')}</div>${key(id === 'appearance' ? '保存形象' : id === 'shards' ? '兑换藏品' : '继续收集', '', 'sample')}`,
    );
  }
  if (id === 'gacha')
    return screen(
      '扭蛋抽奖',
      `${panel(`<span class="panel-label">COLLECTION</span><h4>发现新的伙伴</h4><p>使用抽奖券，收集头像和装饰。</p><div class="capsule"><span>✦</span><b>今日扭蛋</b><small>每一份惊喜都值得收藏</small></div><div class="row between"><span class="tag gold">抽奖券 × 3</span>${key('抽一次', '', 'sample')}</div>`)}${tile('碎片兑换', '用碎片兑换喜欢的藏品', 'shards')}`,
    );
  if (id === 'notepad')
    return screen(
      '狼人杀记事本',
      `${panel(`<h4>本局记事</h4><p>给玩家记录身份线索，只对自己可见。</p>${seatBoard(6)}`)}${panel(`<label>笔记<textarea class="input" rows="5" placeholder="记录你的想法"></textarea></label><div class="spaced">${key('保存笔记', '', 'sample')}</div>`)}`,
    );
  return screen('页面', panel('<h4>页面不可用</h4>'));
}

function admin(id) {
  const entry = adminPages.find(([key]) => key === id);
  const title = entry ? entry[1] : '运营概览';
  let content = '';
  if (id === 'overview')
    content = `<div class="grid-two">${panel('<span class="panel-label">今日活跃</span><h4 class="metric">128</h4><p>活跃用户</p>')}${panel('<span class="panel-label">今日对局</span><h4 class="metric">42</h4><p>完成游戏</p>')}</div>${panel(
      `<h4>今日用量</h4><p>账号级 · 免费计划额度参考</p>${rows([
        ['读取行数', '12,345'],
        ['写入行数', '3,210'],
        ['房间状态', '正常'],
      ])}`,
    )}`;
  else if (id === 'maintenance')
    content = panel(
      `<h4>维护设置</h4><p>维护开启后，新访客会看到维护页面。</p><label>维护说明<textarea class="input" rows="3">系统维护中，请稍后再试。</textarea></label><div class="list-row"><b>开启维护</b><button class="switch" type="button" role="switch" aria-checked="false" data-action="switch"><span></span></button></div>${key('保存维护设置', '', 'sample')}`,
    );
  else if (id.startsWith('words-'))
    content = `${panel(`<h4>词库库存</h4><div class="grid-two"><div><span class="panel-label">可用词条</span><b class="metric">89</b></div><div><span class="panel-label">待审核</span><b class="metric">12</b></div></div><div class="spaced"><label>分类筛选<select class="input"><option>全部分类</option><option>动物</option><option>食物</option></select></label></div>`)}${panel(
      `<h4>词条</h4>${rows([
        ['动物', '28 个'],
        ['食物', '42 个'],
        ['日常', '19 个'],
      ])}`,
    )}${panel(
      `<h4>待审核投稿</h4>${rows([
        ['示例词条', '待审核'],
        ['另一条词语', '待审核'],
      ])}`,
    )}`;
  else if (id.startsWith('agents-'))
    content = `${panel(
      `<h4>补词代理</h4><p>查看代理状态与补词记录。</p>${rows([
        ['系统补词', '启用'],
        ['社区补词', '启用'],
      ])}`,
    )}${panel(
      `<h4>最近批次</h4>${rows([
        ['示例批次', '待审核 12'],
        ['上一批次', '已完成'],
      ])}`,
    )}`;
  else if (id === 'users' || id === 'rooms')
    content = `${panel(`<h4>${title}</h4><p>${id === 'users' ? '搜索用户并查看资料。' : '查看运行状态与开局记录。'}</p><label>搜索<input class="input" placeholder="${id === 'users' ? '搜索昵称或邮箱' : '搜索房间号'}"></label><div class="spaced">${key('搜索', '', 'sample')}</div>`)}${panel(`<h4>${title}</h4><div class="table-wrap" role="region" aria-label="${title}" tabindex="0"><table><thead><tr><th scope="col">${id === 'users' ? '昵称' : '房间号'}</th><th scope="col">状态</th><th scope="col">最近活动</th></tr></thead><tbody><tr><th scope="row">${id === 'users' ? '小雨' : 'ABCD'}</th><td>正常</td><td>今天</td></tr><tr><th scope="row">${id === 'users' ? '阿杰' : 'EFGH'}</th><td>正常</td><td>昨天</td></tr></tbody></table></div>`)}`;
  else {
    const dashboards = {
      growth: {
        stats: [
          ['新注册', '24'],
          ['活跃用户', '128'],
        ],
        sections: [
          ['国家分布', '中国 · 96'],
          ['接入节点', 'HKG · 72'],
        ],
      },
      performance: {
        stats: [
          ['平均加载', '628 ms'],
          ['平均首字节', '142 ms'],
        ],
        sections: [
          ['各国平均加载时间', '中国 · 610 ms'],
          ['运营商', '示例运营商 · 86'],
        ],
      },
      traffic: {
        stats: [
          ['平台请求', '8,642'],
          ['Worker 错误', '2'],
        ],
        sections: [
          ['WebSocket 连接成功', '210'],
          ['状态广播', '1,284'],
          ['HTTP 路由', '/room/command'],
        ],
      },
      d1: {
        stats: [
          ['今日读取行数', '12,345'],
          ['今日写入行数', '3,210'],
        ],
        sections: [
          ['读取行数', '12,345'],
          ['写入行数', '3,210'],
          ['高消耗查询 · 估算', '示例查询'],
        ],
      },
      ai: {
        stats: [
          ['总请求', '128'],
          ['错误率', '0.8%'],
        ],
        sections: [
          ['模型', '示例模型 · 92'],
          ['Provider', '示例提供商 · 128'],
          ['请求结果', '成功 · 127'],
        ],
      },
    };
    const dashboard = dashboards[id];
    content = `${panel(`<span class="panel-label">ADMIN DASHBOARD</span><h4>${title}</h4><p>模拟数据 · 今日</p><div class="grid-two">${dashboard.stats.map(([name, value]) => `<div><span class="panel-label">${name}</span><b class="metric">${value}</b></div>`).join('')}</div>`)}${panel(
      `<h4>数据概览</h4><div class="chart"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>${rows(dashboard.sections)}`,
    )}`;
  }
  return screen(
    title,
    `<div class="admin-links"><button class="tag" type="button" data-page="admin-overview">概览</button><button class="tag" type="button" data-page="admin-users">用户</button><button class="tag" type="button" data-page="admin-rooms">房间</button><button class="tag" type="button" data-page="admin-words-fibking">词库</button></div>${content}`,
    '管理后台 · 示例数据',
  );
}

export function pageView(id, roomState) {
  if (id.startsWith('room-'))
    return room(
      games.find((game) => game.id === id.slice(5)),
      roomState,
    );
  if (id.startsWith('config-')) return config(games.find((game) => game.id === id.slice(7)));
  if (id.startsWith('guide-')) return guide(games.find((game) => game.id === id.slice(6)));
  if (id.startsWith('role-'))
    return screen(
      '角色身份卡',
      `${card(games.find((game) => game.id === id.slice(5)))}${cardBack()}${panel('<p>正面展示身份；卡背用于未查看身份的状态。</p>')}`,
    );
  if (id.startsWith('admin-')) return admin(id.slice(6));
  return product(id);
}

export function pageGroups() {
  return [
    { title: '设计方案', pages: [['gallery', '组件方案对比']] },
    { title: '产品页面', pages: [...productPages, ['boards', '选择板子']] },
    { title: '游戏房间', pages: games.map((game) => [`room-${game.id}`, game.name]) },
    {
      title: '身份卡',
      pages: games
        .filter((game) =>
          ['werewolf', 'avalon', 'fibking', 'undercover', 'secrethitler'].includes(game.id),
        )
        .map((game) => [`role-${game.id}`, game.name]),
    },
    { title: '游戏配置', pages: games.map((game) => [`config-${game.id}`, game.name]) },
    { title: '游戏玩法', pages: games.map((game) => [`guide-${game.id}`, game.name]) },
    { title: '管理后台', pages: adminPages.map(([id, name]) => [`admin-${id}`, name]) },
  ];
}
