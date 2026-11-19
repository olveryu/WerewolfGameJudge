const roles = {
  witch: {
    name: '女巫',
    action: '使用解药',
    detail: '救 3 号',
    skip: '今夜不用药',
    verb: '使用毒药',
  },
  wolf: {
    name: '狼人',
    action: '选择袭击目标',
    detail: '点击座位选择',
    skip: '放弃袭击',
    verb: '袭击',
  },
  guard: {
    name: '守卫',
    action: '选择守护目标',
    detail: '点击座位选择',
    skip: '今夜不守护',
    verb: '守护',
  },
  hunter: { name: '猎人', action: '发动状态', detail: '查看后确认已知', skip: null, verb: '' },
  blocked: { name: '预言家', action: null, detail: '', skip: '确认跳过', verb: '' },
};
const games = {
  werewolf: {
    name: '狼人杀',
    configuration: '预女猎守 · 12 人',
    status: '警长竞选 · 进行中',
    stage: false,
  },
  avalon: {
    name: '阿瓦隆',
    configuration: '标准任务 · 7 人',
    status: '任务轨道 · 第 2 轮',
    stage: false,
  },
  secrethitler: {
    name: '秘密希特勒',
    configuration: '标准对局 · 7 人',
    status: '政策轨道 · 选举进行中',
    stage: false,
  },
  undercover: {
    name: '谁是卧底',
    configuration: '卧底模式 · 8 人',
    status: '发言阶段 · 第 1 轮',
    stage: false,
  },
  fibking: {
    name: '瞎掰王',
    configuration: '标准模式 · 8 人',
    status: '准备阶段 · 等待选词',
    stage: false,
  },
  pictionary: {
    name: '你画我猜接龙',
    configuration: '接龙模式 · 8 人',
    status: '作品创作中',
    stage: true,
  },
  drawguess: {
    name: '你画我猜',
    configuration: '绘画模式 · 8 人',
    status: '本轮正在绘画',
    stage: true,
  },
  storyrelay: {
    name: '轮流讲故事',
    configuration: '故事接龙 · 8 人',
    status: '故事创作中',
    stage: true,
  },
  spotmatch: {
    name: '一眼成对',
    configuration: '标准模式 · 8 人',
    status: '正在寻找相同图案',
    stage: true,
  },
};
const stages = {
  lobby: {
    label: '待开局',
    title: '座位已满，等待发牌',
    message: '身份尚未分配，可以先查看配置或手册。',
  },
  assigned: {
    label: '已发牌',
    title: '查看你的身份',
    message: '查看身份后，等待房主开始游戏。',
  },
  'night-audio': {
    label: '第 1 夜 · 播报中',
    title: '请听语音播报',
    message: '行动和房主命令锁定，仍可打开手册。',
  },
  'night-action': {
    label: '第 1 夜',
    title: '',
    message: '选择行动后仍需明确确认，选目标时手牌会让开座位。',
  },
  'night-wait': {
    label: '第 1 夜 · 等待中',
    title: '你的行动已完成',
    message: '等待其他角色，不需要重复提交。',
  },
  day: {
    label: '第 1 天',
    title: '天亮了，回到讨论',
    message: '白天讨论在线下进行。昨夜信息和复盘权限由房主处理。',
  },
  ended: {
    label: '本局结束',
    title: '本局已结束',
    message: '可以查看复盘；下一局、返回大厅由房主操作。',
  },
  'stage-game': { label: '游戏进行中', title: '正在游戏', message: '操作留在游戏界面中。' },
  reveal: { label: '逐段揭晓', title: '一起观看', message: '所有人跟随房间进度观看。' },
  aborted: { label: '已中止', title: '本局已中止', message: '已收录的内容仍可查看。' },
};
const faces = {
  hand: { title: '我的手牌', parent: null, kind: 'hand' },
  resources: { title: '手册', parent: 'hand', kind: 'hand' },
  host: { title: '房主管理', parent: 'hand', kind: 'hand' },
  menu: { title: '菜单', parent: null, kind: 'hand' },
  rules: { title: '玩法', parent: 'resources', kind: 'dialog' },
  notes: { title: '笔记', parent: 'resources', kind: 'dialog' },
  nomination: { title: '板型建议', parent: 'hand', kind: 'dialog' },
  nominations: { title: '查看建议', parent: 'hand', kind: 'dialog' },
  'room-config': {
    title: '配置板子',
    parent: 'host',
    kind: 'page',
    route: '/game/werewolf/config/edit/6X9K',
  },
  music: {
    title: '音乐设置',
    parent: 'host',
    kind: 'page',
    route: '/settings/music/6X9K',
  },
  guide: { title: '攻略', parent: 'resources', kind: 'dialog' },
  identity: { title: '查看身份', parent: 'hand', kind: 'dialog' },
  review: { title: '本局复盘', parent: null, kind: 'dialog' },
  'review-share': { title: '分享战报 · 预览', parent: null, kind: 'dialog' },
  'hunter-status': { title: '发动状态', parent: 'hand', kind: 'dialog' },
  'host-info': { title: '昨夜信息', parent: 'host', kind: 'dialog' },
  share: { title: '分享房间', parent: 'host', kind: 'dialog' },
  mvp: { title: '本局 MVP', parent: 'host', kind: 'dialog' },
  grant: { title: '授权查看本局复盘', parent: 'host', kind: 'dialog' },
  'match-config': { title: '本局配置', parent: null, kind: 'dialog' },
  'public-records': { title: '公开记录', parent: null, kind: 'dialog' },
};
const configuredRoles = [
  { name: '狼人', count: 4, description: '狼人阵营，夜间参与狼队行动。' },
  { name: '预言家', count: 1, description: '好人阵营，夜间查验一名玩家的阵营。' },
  { name: '女巫', count: 1, description: '好人阵营，拥有解药和毒药。' },
  { name: '猎人', count: 1, description: '好人阵营，满足发动条件时可以开枪。' },
  { name: '守卫', count: 1, description: '好人阵营，夜间选择守护目标。' },
  { name: '平民', count: 4, description: '好人阵营，通过发言和投票寻找狼人。' },
];
const revealExamples = {
  storyrelay: [
    '从前，森林里出现了一盏灯。',
    '旅人顺着灯光找到了一座桥。',
    '桥的另一端，朋友们正在等候。',
  ],
  pictionary: ['第一位玩家写下：一只猫。', '第二位玩家画了一幅画。', '第三位玩家猜测：一只猫。'],
};
const state = {
  game: 'werewolf',
  stage: 'night-action',
  role: 'witch',
  host: false,
  target: null,
  targeting: false,
  viewedRole: false,
  reviewAllowedSeats: [],
  announced: false,
  wolfVote: null,
  lastAction: '',
  mvp: '',
  savedNote: '',
  accountOpen: false,
  menuOpen: false,
  roleDesign: 'inline',
  hostIndicator: 'dot',
  nominations: [],
  nominationDirty: false,
  revealedPosition: 1,
  revealPaused: true,
  pendingHunterStatus: false,
  drafts: {},
};
const navigation = { face: 'hand', trail: [], surface: null };
const backCard = {
  id: 'back',
  label: '返回',
  accessibleName: '返回我的手牌',
  icon: 'back',
  category: 'secondary',
  activate: backFace,
};
const hand = document.querySelector('#action-wheel');
const handBody = document.querySelector('#hand-body');
const confirmation = document.querySelector('#confirmation');
const detailDialog = document.querySelector('#detail-dialog');
const roleDialog = document.querySelector('#role-dialog');
const discardDialog = document.querySelector('#discard-dialog');
const pageScreen = document.querySelector('#page-screen');
const stageSelect = document.querySelector('#stage-select');
const board = document.querySelector('#board');
const roomScreen = document.querySelector('.game-screen');
const phaseTitle = document.querySelector('#phase-title');
const phaseDescription = document.querySelector('#phase-description');
const interactionLog = [];
let pendingConfirmation = null;
const previewUrl = `${location.pathname}${location.search}`;
history.replaceState({ actionHandPage: null }, '', previewUrl);

function record(event, details = {}) {
  interactionLog.push({
    time: new Date().toISOString(),
    event,
    stage: state.stage,
    role: state.role,
    host: state.host,
    face: navigation.face,
    ...details,
  });
  if (interactionLog.length > 60) interactionLog.shift();
  document.querySelector('#prototype-log').textContent = interactionLog
    .map((entry) => JSON.stringify(entry))
    .join('\n');
}

function fail(code, message) {
  throw new Error(`[ActionHandMock/${code}] ${message}`);
}

window.addEventListener('error', (event) => {
  record('error', {
    message: event.message,
    source: `${event.filename}:${event.lineno}:${event.colno}`,
  });
  const banner = document.querySelector('#prototype-error');
  banner.hidden = false;
  banner.textContent = `原型操作失败：${event.message}。上下文已记录在本页交互日志。`;
  phaseTitle.textContent = '原型操作失败';
  phaseDescription.textContent = '请查看交互日志；没有提交真实游戏操作。';
});

function isHandOpen() {
  return !hand.hidden;
}

function hideHand() {
  hand.hidden = true;
}

function focusFace(focusKey = null) {
  if (focusKey !== null) {
    const card = hand.querySelector(
      `[data-tool-view="${navigation.face}"] [data-card-id="${focusKey}"]`,
    );
    if (card === null) fail('MISSING_RETURN_CARD', `找不到返回焦点卡牌：${focusKey}`);
    if (card.disabled) document.querySelector('#face-title').focus({ preventScroll: true });
    else card.focus({ preventScroll: true });
  } else {
    document.querySelector('#face-title').focus({ preventScroll: true });
  }
}

function showFace() {
  const face = faces[navigation.face];
  for (const section of hand.querySelectorAll('[data-tool-view]')) {
    const inactive = section.dataset.toolView !== navigation.face;
    section.hidden = inactive;
    section.inert = inactive;
  }
  document.querySelector('#face-title').textContent = face.title;
  renderSurface();
}

function renderSurface() {
  const surface = navigation.surface;
  const isPage = surface?.kind === 'page';
  pageScreen.hidden = !isPage;
  pageScreen.inert = !isPage;
  for (const section of document.querySelectorAll('[data-surface-view]')) {
    const inactive = section.dataset.surfaceView !== surface?.name;
    section.hidden = inactive;
    section.inert = inactive;
  }
  if (surface !== null) {
    const view = faces[surface.name];
    document.querySelector(isPage ? '#page-title' : '#detail-title').textContent = view.title;
    if (isPage) {
      pageScreen.dataset.route = view.route;
      document
        .querySelector('#page-back')
        .setAttribute('aria-label', `返回${faces[navigation.face].title}`);
    } else detailDialog.dataset.presentation = surface.kind;
  }
  document.title = `${state.accountOpen ? '设置' : faces[surface?.name ?? navigation.face].title} · 行动手牌原型`;
}

function openSurface(name, focusKey, fromHistory) {
  if (navigation.surface !== null) fail('SURFACE_ALREADY_OPEN', '请先关闭当前页面或弹窗');
  const view = faces[name];
  navigation.surface = { name, kind: view.kind, focusKey };
  if (name === 'nomination') {
    const nomination = state.nominations[0];
    document.querySelector('#nomination-name').value = nomination?.name ?? '预女猎守';
    document.querySelector('#nomination-reason').value = nomination?.reason ?? '';
    document.querySelector('#nomination-closed').hidden = state.stage === 'lobby';
    document.querySelector('#submit-nomination').disabled = state.stage !== 'lobby';
    document.querySelector('#simulate-deal').disabled = state.stage !== 'lobby';
    state.nominationDirty = false;
  }
  if (name === 'nominations') {
    const list = document.querySelector('#nomination-list');
    list.replaceChildren();
    for (const nomination of state.nominations) {
      const heading = document.createElement('strong');
      const reason = document.createElement('p');
      heading.textContent = nomination.name;
      reason.textContent = nomination.reason || '没有填写推荐理由。';
      list.append(heading, reason);
    }
  }
  if (name === 'match-config') {
    document.querySelector('#role-layout').classList.remove('show-role');
    document.querySelector('#role-back').hidden = true;
  }
  if (name === 'grant') {
    for (const input of document.querySelectorAll('#grant-seats input'))
      input.checked = state.reviewAllowedSeats.includes(Number(input.value));
  }
  if (view.kind === 'page' && !fromHistory) {
    history.pushState(
      {
        actionHandPage: {
          name,
          focusKey,
          face: navigation.face,
          trail: navigation.trail,
        },
      },
      '',
      `${previewUrl}#${view.route}`,
    );
  }
  render();
  if (view.kind === 'page') {
    pageScreen.scrollTop = 0;
    document.querySelector('#page-title').focus({ preventScroll: true });
  } else detailDialog.showModal();
  record('surface.open', { surface: name, presentation: view.kind, route: view.route });
}

function resetSurface() {
  if (navigation.surface?.kind === 'page')
    history.replaceState({ actionHandPage: null }, '', previewUrl);
  if (detailDialog.open) detailDialog.close('context-change');
  navigation.surface = null;
}

function openHand(reset = true, focusKey = null) {
  if (reset) {
    navigation.face = 'hand';
    navigation.trail = [];
    handBody.scrollTop = 0;
  }
  renderCards();
  showFace();
  hand.hidden = false;
  focusFace(focusKey);
}

function canReview() {
  return (
    ['day', 'ended'].includes(state.stage) && (state.host || state.reviewAllowedSeats.includes(6))
  );
}

function navigateFace(name, focusKey, { confirmed = false, fromHistory = false } = {}) {
  if (!Object.hasOwn(faces, name)) fail('UNKNOWN_FACE', `未知牌面：${name}`);
  const parent = faces[name].parent;
  if (
    parent !== null &&
    parent !== navigation.face &&
    !(name === 'resources' && navigation.face === 'menu')
  )
    fail('INVALID_NAVIGATION', `不能从 ${navigation.face} 直接进入 ${name}`);
  if ((name === 'host' || parent === 'host') && !state.host)
    fail('HOST_REQUIRED', '房主牌面仅房主可访问');
  if (parent === 'host') requireHostCard(name);
  if (name === 'review' && !canReview())
    fail('REVIEW_NOT_GRANTED', '当前阶段或视角尚未获得复盘权限');
  if (name === 'identity' && ['lobby', 'night-audio'].includes(state.stage))
    fail('IDENTITY_UNAVAILABLE', '当前阶段没有查看身份操作');
  if (['review', 'host-info'].includes(name) && !confirmed) {
    const review = name === 'review';
    askConfirmation({
      title: review ? '查看本局复盘？' : '查看昨夜信息？',
      message: review
        ? state.stage === 'ended'
          ? '本局复盘包含全员身份和行动记录，请确认是否继续。'
          : '本局复盘包含全员身份和行动记录，查看后可能影响警长竞选，请确认是否继续。'
        : state.stage === 'ended'
          ? '请确认是否现在查看昨夜信息。'
          : '昨夜信息可能影响警长竞选，请确认是否现在查看。',
      label: '确定查看',
      focusKey,
      commit: () => navigateFace(name, focusKey, { confirmed: true }),
    });
    return;
  }
  if (name === 'host-info') state.announced = true;
  if (name === 'identity' && state.stage === 'assigned') {
    state.viewedRole = true;
    record('identity.viewed');
  }
  if (faces[name].kind !== 'hand') {
    openSurface(name, focusKey, fromHistory);
    return;
  }
  navigation.trail.push({
    face: navigation.face,
    scrollTop: handBody.scrollTop,
    focusKey,
  });
  navigation.face = name;
  handBody.scrollTop = 0;
  renderCards();
  showFace();
  focusFace();
  record('face.open');
}

function backFace() {
  if (navigation.face === 'menu') {
    state.menuOpen = false;
    navigation.face = 'hand';
    navigation.trail = [];
    render();
    document.querySelector('#stage-menu-trigger').focus();
    return;
  }
  const previous = navigation.trail.pop();
  if (previous === undefined) fail('NO_PARENT_FACE', '当前牌面没有上一级');
  navigation.face = previous.face;
  showFace();
  handBody.scrollTop = previous.scrollTop;
  focusFace(previous.focusKey);
  record('face.back');
}

function makeCard(
  {
    id,
    label,
    icon,
    activate,
    category,
    priority = 'secondary',
    detail = '',
    disabled = false,
    accessibleName = null,
    pending = false,
  },
  existing = null,
) {
  const button = existing ?? document.createElement('button');
  button.type = 'button';
  button.className = 'hand-card';
  button.dataset.cardId = id;
  button.dataset.priority = priority;
  button.dataset.category = category;
  button.dataset.pending = pending ? state.hostIndicator : '';
  button.disabled = disabled;
  if (accessibleName === null) button.removeAttribute('aria-label');
  else button.setAttribute('aria-label', accessibleName);
  if (disabled && detail !== '') button.setAttribute('aria-description', detail);
  else button.removeAttribute('aria-description');
  if (existing === null) {
    const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    symbol.setAttribute('aria-hidden', 'true');
    symbol.append(document.createElementNS('http://www.w3.org/2000/svg', 'use'));
    const marker = symbol.cloneNode(true);
    marker.classList.add('card-corner', 'card-corner-end');
    button.append(symbol, document.createElement('strong'), marker);
  }
  button.querySelector('strong').textContent = label;
  for (const use of button.querySelectorAll('use')) use.setAttribute('href', `#icon-${icon}`);
  if (pending && state.hostIndicator === 'symbol')
    button.querySelector('.card-corner use').setAttribute('href', '#icon-alert');
  button.onclick = () => {
    record('card.activate', { card: id });
    activate(id);
  };
  return button;
}

function renderRow(id, cards, category = 'secondary') {
  const row = document.querySelector(`#${id}`);
  row.style.setProperty('--card-count', String(cards.length));
  row.dataset.stacked = String(cards.length > 3);
  const existing = new Map([...row.children].map((button) => [button.dataset.cardId, button]));
  cards.forEach((card, index) => {
    const button = makeCard({ category, ...card }, existing.get(card.id) ?? null);
    existing.delete(card.id);
    const distance = index - (cards.length - 1) / 2;
    button.style.setProperty('--fan-angle', `${distance * 1.5}deg`);
    button.style.setProperty('--fan-drop', `${Math.abs(distance) * 4}px`);
    button.style.setProperty('--fan-order', String(index + 1));
    if (row.children.item(index) !== button) row.insertBefore(button, row.children.item(index));
  });
  for (const button of existing.values()) button.remove();
}

function playerCards() {
  const primary = [];
  const secondary = [];
  if (state.game !== 'werewolf') {
    if (['day', 'night-action', 'night-wait'].includes(state.stage))
      secondary.push({
        id: 'identity',
        label: '查看身份',
        icon: 'person',
        activate: (id) => navigateFace('identity', id),
      });
    if (['ended', 'aborted'].includes(state.stage))
      secondary.push({
        id: 'review',
        label: '本局复盘',
        icon: 'book',
        activate: (id) => openSurface('review', id, false),
      });
    return { primary, secondary };
  }
  const role = roles[state.role];
  const identity = {
    id: 'identity',
    label: state.stage === 'assigned' ? '查看我的身份' : '查看身份',
    icon: 'person',
    activate: (id) => navigateFace('identity', id),
  };
  if (state.stage === 'assigned')
    primary.push({
      ...identity,
      priority: 'primary',
      detail: state.viewedRole ? '已查看 · 可以再次打开' : '仅自己查看',
    });
  if (!['lobby', 'assigned', 'night-audio'].includes(state.stage)) secondary.push(identity);
  if (state.stage === 'night-action') {
    if (role.action !== null) {
      primary.push({
        id: 'role-action',
        label: role.action,
        detail: role.detail,
        icon: state.role === 'witch' ? 'potion' : 'target',
        priority: ['wolf', 'guard'].includes(state.role) ? 'target' : 'primary',
        activate: activateRole,
      });
    }
    if (state.role === 'witch')
      primary.push({
        id: 'poison',
        label: '选择毒药目标',
        detail: '选人后再次确认',
        icon: 'target',
        priority: 'target',
        activate: beginTargeting,
      });
    if (role.skip !== null)
      secondary.unshift({ id: 'skip', label: role.skip, icon: 'skip', activate: skipAction });
    if (state.role === 'wolf' && state.wolfVote !== null)
      secondary.splice(1, 0, {
        id: 'withdraw',
        label: '撤回投票',
        icon: 'back',
        activate: withdrawVote,
      });
  }
  if (['day', 'ended'].includes(state.stage) && !state.host) {
    secondary.push({
      id: 'review',
      label: '查看复盘',
      icon: 'book',
      priority: 'ghost',
      detail: canReview() ? '' : '等待房主授权',
      disabled: !canReview(),
      activate: (id) => navigateFace('review', id),
    });
  }
  return { primary, secondary };
}

function projectHostCards() {
  if (!state.host) return [];
  const cards = [];
  const locked = state.stage === 'night-audio';
  const command = (id, label, priority = 'secondary', disabled = false, detail = '') =>
    cards.push({
      id,
      label,
      icon: priority === 'danger' ? 'skip' : 'check',
      priority,
      disabled: locked || disabled,
      detail: locked ? '语音播放中，暂不可用' : detail,
      activate: () => requestHostCommand(id),
    });
  const surface = (id, label, detail = '', priority = 'secondary', disabled = false) =>
    cards.push({
      id,
      label,
      icon: id === 'music' ? 'tools' : 'book',
      priority,
      detail,
      disabled: locked || disabled,
      activate: (key) => navigateFace(id, key),
    });
  if (state.stage === 'lobby') {
    command('deal', '分配角色', 'primary', false, '12/12 已入座');
    surface('room-config', '配置板子');
    surface('share', '分享房间');
  } else if (state.stage === 'assigned') {
    command(
      'start',
      '开始游戏',
      'primary',
      !state.viewedRole,
      state.viewedRole ? '12/12 已查看身份' : '11/12 已查看身份，尚差你',
    );
  } else if (state.game === 'werewolf' && ['day', 'ended'].includes(state.stage)) {
    surface('host-info', state.announced ? '再次查看昨夜信息' : '昨夜信息');
    surface('review', '查看本局复盘');
    surface('grant', '授权玩家查看');
    if (state.stage === 'ended') {
      surface(
        'mvp',
        state.mvp ? `MVP：${state.mvp}` : '评选 MVP',
        state.mvp ? '本局已评选' : '',
        'secondary',
        state.mvp !== '',
      );
      command('next', '再来一局', 'danger');
      command('lobby', '返回大厅', 'danger');
    }
  } else if (state.stage === 'ended' || state.stage === 'aborted') {
    if (state.stage === 'ended') command('next', '再来一局', 'danger');
    command('lobby', '返回大厅', 'danger');
  }
  if (['lobby', 'assigned'].includes(state.stage)) surface('music', '音乐设置');
  if (['assigned', 'night-audio', 'night-action', 'night-wait', 'day'].includes(state.stage))
    command('abort', '中止本局', 'danger');
  return cards;
}

function requireHostCard(id) {
  if (!state.host) fail('HOST_REQUIRED', '此操作仅限房主');
  const card = projectHostCards().find((item) => item.id === id);
  if (card === undefined) fail('HOST_ACTION_UNAVAILABLE', `当前阶段不能执行房主操作：${id}`);
  if (card.disabled) fail('HOST_ACTION_LOCKED', `${card.label}不可用：${card.detail}`);
  return card;
}

function renderCards() {
  const cards = playerCards();
  const entries = [
    ...(['lobby', 'assigned'].includes(state.stage)
      ? []
      : [
          {
            id: 'match-config',
            label: '本局配置',
            icon: 'book',
            category: 'resources',
            activate: (id) => navigateFace('match-config', id),
          },
        ]),
    {
      id: 'resources',
      label: '手册',
      detail: '玩法 · 攻略 · 笔记',
      icon: 'book',
      category: 'resources',
      activate: (id) => navigateFace('resources', id),
    },
  ];
  const hostHasPendingAction = projectHostCards().some(
    (card) => ['deal', 'start'].includes(card.id) && !card.disabled,
  );
  if (state.host)
    entries.push({
      id: 'host',
      label: '房主管理',
      detail: '仅房主 · 本阶段操作',
      icon: 'tools',
      category: 'host',
      pending: hostHasPendingAction,
      accessibleName: hostHasPendingAction ? '房主管理，有待处理操作' : null,
      activate: (id) => navigateFace('host', id),
    });
  renderRow('hand-cards', [
    ...cards.primary.map((card) => ({ ...card, category: 'primary' })),
    ...cards.secondary,
    ...(state.game === 'werewolf' && state.stage === 'lobby'
      ? [
          {
            id: 'nomination',
            label: state.nominations.length ? '修改建议' : '我来建议',
            icon: 'note',
            activate: (id) => navigateFace('nomination', id),
          },
          ...(state.nominations.length
            ? [
                {
                  id: 'nominations',
                  label: `查看建议 ${state.nominations.length}`,
                  icon: 'book',
                  activate: (id) => navigateFace('nominations', id),
                },
              ]
            : []),
        ]
      : []),
    ...entries,
  ]);
  renderRow(
    'resource-cards',
    [
      backCard,
      { id: 'rules', label: '玩法', icon: 'book', activate: (id) => navigateFace('rules', id) },
      { id: 'guide', label: '攻略', icon: 'target', activate: (id) => navigateFace('guide', id) },
      ...(state.game === 'werewolf' && ['day', 'ended'].includes(state.stage)
        ? [
            {
              id: 'notes',
              label: '笔记',
              icon: 'note',
              activate: (id) => navigateFace('notes', id),
            },
          ]
        : []),
    ],
    'resources',
  );
  const hostCards = projectHostCards();
  renderRow('host-cards', state.host ? [backCard, ...hostCards] : [], 'host');
  renderRow('menu-cards', [
    { ...backCard, accessibleName: '收起菜单' },
    {
      id: 'resources',
      label: '手册',
      icon: 'book',
      category: 'resources',
      activate: (id) => navigateFace('resources', id),
    },
    {
      id: 'match-config',
      label: '本局配置',
      icon: 'book',
      category: 'resources',
      activate: (id) => navigateFace('match-config', id),
    },
    ...(state.host && state.stage === 'stage-game'
      ? [
          {
            id: 'abort-stage',
            label: '中止游戏',
            icon: 'skip',
            priority: 'danger',
            activate: () => requestStageAbort(),
          },
        ]
      : []),
  ]);
  document.querySelector('#identity').textContent =
    state.game === 'werewolf'
      ? `你的身份是${roles[state.role].name}。`
      : '这里展示仅自己可见的身份信息。';
  document
    .querySelector('#identity-icon')
    .setAttribute('href', state.role === 'witch' ? '#icon-potion' : '#icon-target');
  document.querySelector('#guide-role-title').textContent = `${roles[state.role].name}操作提示`;
  if (state.game !== 'werewolf')
    document.querySelector('#guide-role-title').textContent = `${games[state.game].name}攻略示意`;
  document.querySelector('#guide-copy').textContent =
    state.game === 'werewolf'
      ? '先核对自己的角色与可用技能，再选择目标。确认之前，检查座位编号。'
      : '这里预览攻略入口和阅读方式，具体内容以正式游戏为准。';
  document.querySelector('#guide-extra').hidden = state.game !== 'werewolf';
  detailDialog.querySelector('.detail-header form').hidden =
    navigation.surface?.name === 'hunter-status';
  document.querySelector('#mvp-seat').disabled = state.mvp !== '';
  document.querySelector('#confirm-mvp').disabled =
    state.mvp !== '' || document.querySelector('#mvp-seat').value === '';
  document.querySelector('#mvp-feedback').textContent =
    state.mvp === '' ? '' : `本局 MVP：${state.mvp}（模拟）。`;
}

function render() {
  const stage = stages[state.stage];
  const role = roles[state.role];
  const game = games[state.game];
  const isStage = game.stage && ['stage-game', 'reveal'].includes(state.stage);
  stageSelect.value = state.stage;
  const isPage = navigation.surface?.kind === 'page';
  roomScreen.hidden = state.accountOpen || isPage;
  roomScreen.inert = state.accountOpen || isPage;
  hand.hidden = state.targeting || state.accountOpen || isPage || (isStage && !state.menuOpen);
  document.querySelector('#game-title').textContent = game.name;
  document.querySelector('#player-count').textContent =
    `${game.configuration.match(/\d+/)[0]} 位玩家（示例）`;
  document.querySelector('#account-trigger').hidden = isStage;
  document.querySelector('#stage-menu-trigger').hidden = !isStage;
  board.hidden = isStage || (game.stage && ['ended', 'aborted'].includes(state.stage));
  document.querySelector('#stage-content').hidden =
    !isStage && !(game.stage && ['ended', 'aborted'].includes(state.stage));
  document.querySelector('.board-information').hidden = isStage;
  document.querySelector('#reveal-controls').hidden = state.stage !== 'reveal' || !state.host;
  document.querySelector('#stage-heading').textContent =
    state.stage === 'reveal'
      ? `同步揭晓 · 第 ${state.revealedPosition} 段`
      : state.stage === 'aborted'
        ? '已收录的内容'
        : state.stage === 'ended'
          ? '本局作品与结果'
          : game.status;
  document.querySelector('#stage-timer').textContent = isStage ? '剩余 01:24 · 演示' : '';
  document.querySelector('#stage-copy').textContent =
    state.stage === 'reveal'
      ? `示例 · 第 ${state.revealedPosition} 段：${revealExamples[state.game][state.revealedPosition - 1]}`
      : state.stage === 'aborted'
        ? '本局中止；这里保留已经收录的内容。'
        : state.stage === 'ended' && revealExamples[state.game]
          ? `示例作品：${revealExamples[state.game].join(' / ')}`
          : state.stage === 'ended'
            ? '这里展示可以自由翻阅的故事、画廊或结果。'
            : `${game.name}的游戏画布、编辑器或实时牌桌。`;
  document.querySelector('#reveal-previous').disabled = state.revealedPosition === 1;
  document.querySelector('#reveal-next').disabled = state.revealedPosition === 3;
  document.querySelector('#reveal-play').textContent = state.revealPaused ? '播放' : '暂停';
  const isEditor =
    state.stage === 'stage-game' && ['storyrelay', 'drawguess', 'pictionary'].includes(state.game);
  const draft = document.querySelector('#stage-draft');
  if (draft.dataset.game !== state.game) {
    draft.dataset.game = state.game;
    draft.value = state.drafts[state.game] ?? '';
  }
  draft.hidden = !isEditor;
  document.querySelector('#stage-draft-label').hidden = !isEditor;
  document.querySelector('#stage-match').hidden =
    state.stage !== 'stage-game' || state.game !== 'spotmatch';
  document.querySelector('#stage-match-feedback').hidden =
    state.stage !== 'stage-game' || state.game !== 'spotmatch';
  document.querySelector('#simulate-hunter-turn').hidden = state.game !== 'werewolf';
  document.querySelector('#detail-config-title').textContent = game.configuration;
  document.querySelector('.board-info-heading h3').textContent = game.configuration;
  document.querySelector('#rules-heading').textContent = `${game.name}玩法`;
  document.querySelector('#rules-copy').textContent =
    state.game === 'werewolf'
      ? '夜晚跟随语音，轮到自己时选择行动；选人和放弃均需明确确认。'
      : `这里展示${game.name}的玩法说明。内容为界面示意，正式规则以本局设置为准。`;
  const recordContent = {
    werewolf: ['第 1 天 · 警长竞选', '上警：2、6、9 号。退水：9 号。竞选结果：6 号当选警长。'],
    avalon: ['任务与投票记录', '第 1 轮任务成功；第 2 轮组队提案正在讨论。'],
    secrethitler: ['政府与政策记录', '上一轮选举通过，政府施行了一张政策。'],
  };
  const record = recordContent[state.game];
  if (record !== undefined) {
    document.querySelector('#record-heading').textContent = record[0];
    document.querySelector('#record-copy').textContent = record[1];
  }
  document.querySelector('#detail-roles').hidden = state.game !== 'werewolf';
  document.querySelector('#role-explanation').hidden = state.game !== 'werewolf';
  document.querySelector('#pregame-roles').hidden = state.game !== 'werewolf';
  document.querySelector('.scenarios:has([name="scenario"])').hidden = state.game !== 'werewolf';
  document.querySelector('#account-screen').hidden = !state.accountOpen;
  phaseTitle.textContent =
    state.stage === 'night-action' && state.game === 'werewolf'
      ? state.role === 'blocked'
        ? '本步技能受限'
        : `${role.name}请行动`
      : state.game !== 'werewolf' && state.stage === 'day'
        ? game.status
        : stage.title;
  phaseDescription.textContent =
    state.lastAction ||
    (state.game !== 'werewolf' && state.stage === 'day'
      ? '以下为界面示意，不模拟真实游戏规则。'
      : state.stage === 'night-action' && state.role === 'blocked'
        ? '本步只能确认跳过，跳过同样是有效操作。'
        : stage.message);
  document.querySelector('#stage-label').textContent =
    state.game !== 'werewolf' && state.stage === 'day' ? '游戏进行中' : stage.label;
  const isPregame = ['lobby', 'assigned'].includes(state.stage);
  document.querySelector('#pregame-config').hidden = !isPregame;
  document.querySelector('#match-status').hidden = isPregame;
  document.querySelector('#public-record-trigger').hidden =
    !['werewolf', 'avalon', 'secrethitler'].includes(state.game) ||
    !['day', 'ended'].includes(state.stage);
  document.querySelector('#public-status').textContent =
    state.game !== 'werewolf'
      ? game.status
      : state.stage === 'ended'
        ? '好人阵营获胜 · 演示结果'
        : state.stage === 'day'
          ? '警长：6 号 · 演示记录'
          : state.stage === 'night-audio'
            ? '夜间流程 · 正在播报'
            : state.stage === 'night-wait'
              ? '夜间流程 · 等待其他角色'
              : '夜间流程 · 行动阶段';
  document.querySelector('#public-record-result').hidden = state.stage !== 'ended';
  document
    .querySelector('.night-label use')
    .setAttribute(
      'href',
      state.stage.startsWith('night')
        ? '#icon-moon'
        : state.stage === 'day'
          ? '#icon-sun'
          : '#icon-check',
    );
  document.querySelector('#viewer-label').textContent = state.host ? '房主 · 6 号玩家' : '玩家视角';
  if (state.targeting) {
    phaseTitle.textContent =
      state.target === null ? `请选择${role.verb}目标` : `已选择 ${state.target} 号`;
    phaseDescription.textContent = '选中后仍需明确确认，也可以返回手牌。';
  } else if (state.wolfVote !== null && state.stage === 'night-action') {
    phaseTitle.textContent =
      state.wolfVote === 'empty' ? '已投放弃袭击' : `已投 ${state.wolfVote} 号`;
    phaseDescription.textContent = '狼队尚未完成时，可修改目标或撤回自己的投票。';
  }
  document.querySelector('#cancel-target').hidden = !state.targeting;
  document.querySelector('#cancel-target').textContent = '返回手牌';
  const confirmTarget = document.querySelector('#confirm-target');
  confirmTarget.hidden = !state.targeting;
  confirmTarget.disabled = state.target === null;
  confirmTarget.textContent =
    state.target === null ? '请先选择目标' : `确认对 ${state.target} 号${role.verb}`;
  for (const seat of board.querySelectorAll('button')) {
    const number = Number(seat.dataset.seat);
    seat.disabled =
      !state.targeting ||
      state.stage !== 'night-action' ||
      ['hunter', 'blocked'].includes(state.role) ||
      (number === 6 && state.role !== 'guard');
    seat.hidden = number > Number(game.configuration.match(/\d+/)[0]);
    seat.setAttribute('aria-pressed', String(number === state.target));
  }
  renderCards();
  showFace();
}

function setStage(stage) {
  if (!Object.hasOwn(stages, stage)) fail('UNKNOWN_STAGE', `未知模拟阶段：${stage}`);
  resetSurface();
  hideHand();
  state.stage = stage;
  state.target = null;
  state.targeting = false;
  state.pendingHunterStatus = false;
  state.wolfVote = null;
  state.accountOpen = false;
  state.menuOpen = false;
  state.revealedPosition = 1;
  navigation.face = 'hand';
  navigation.trail = [];
  if (['lobby', 'assigned'].includes(stage)) {
    state.viewedRole = false;
    state.reviewAllowedSeats = [];
    state.announced = false;
    state.mvp = '';
    document.querySelector('#mvp-seat').value = '';
  }
  if (stage !== 'night-wait') state.lastAction = '';
  record('stage.change');
  render();
}

function requestStageAbort() {
  askConfirmation({
    title: '确认中止游戏',
    message: '中止后不会产生正常完成奖励。已收录的内容仍可查看。',
    label: '确认中止',
    focusKey: 'abort-stage',
    danger: true,
    commit: () => setStage('aborted'),
  });
}

function requirePlayerTurn() {
  if (state.stage !== 'night-action') fail('PLAYER_ACTION_LOCKED', '当前不是自己的可行动阶段');
}

function finishAction(message) {
  state.lastAction = message;
  record('player.complete', { action: message });
  setStage('night-wait');
}

function beginTargeting() {
  requirePlayerTurn();
  hideHand();
  state.targeting = true;
  render();
  board.querySelector('button:not(:disabled)').focus();
}

function askConfirmation({
  title,
  message,
  label,
  commit,
  focusKey,
  danger = false,
  shareReview = false,
}) {
  if (pendingConfirmation !== null) fail('CONFIRMATION_PENDING', '已有待确认操作，不能重复提交');
  pendingConfirmation = {
    commit,
    focusKey,
    stage: state.stage,
    targeting: state.targeting,
    shareReview,
  };
  document.querySelector('#confirmation-title').textContent = title;
  document.querySelector('#confirmation-description').textContent = message;
  const button = document.querySelector('#confirm-action');
  button.textContent = label;
  button.className = danger ? 'secondary-button danger-button' : 'primary-button';
  document.querySelector('#share-ended-review').hidden = !shareReview;
  document.querySelector('#confirmation-cancel').textContent = shareReview ? '取消' : '返回修改';
  confirmation.showModal();
}

function askPlayerAction(id, message, commit) {
  requirePlayerTurn();
  askConfirmation({
    title: '确认本夜行动',
    message,
    label: '确认本夜行动',
    focusKey: id,
    commit: () => {
      requirePlayerTurn();
      commit();
    },
  });
}

function activateRole(id) {
  requirePlayerTurn();
  if (state.role === 'witch')
    askPlayerAction(id, '对 3 号使用解药？请再次核对目标。', () =>
      finishAction('已对 3 号使用解药'),
    );
  else if (state.role === 'hunter') navigateFace('hunter-status', id);
  else beginTargeting();
}

function skipAction(id) {
  askPlayerAction(id, `确定${roles[state.role].skip}？`, () => {
    if (state.role === 'wolf') {
      state.wolfVote = 'empty';
      state.target = null;
      render();
    } else finishAction(`已选择${roles[state.role].skip}`);
  });
}

function withdrawVote(id) {
  askPlayerAction(id, '撤回自己的袭击投票？不会改变其他狼人的选择。', () => {
    state.wolfVote = null;
    state.target = null;
    render();
    focusFace('role-action');
  });
}

const hostCommands = {
  deal: { message: '给本原型中的 12 位玩家分配角色？', apply: () => setStage('assigned') },
  start: {
    message: '全员已查看身份，开始本原型的夜晚播报？',
    apply: () => setStage('night-audio'),
  },
  next: { message: '保留座位与设置，重新发牌？仅操作本原型。', apply: () => setStage('assigned') },
  lobby: {
    message: '保留座位与设置，清除当前对局？仅操作本原型。',
    apply: () => setStage('lobby'),
  },
  abort: {
    message: '中止本原型对局并回到待开局？不进行正常胜负结算。',
    apply: () => setStage('lobby'),
  },
};

function requestHostCommand(id) {
  const card = requireHostCard(id);
  askConfirmation({
    title: `确认${card.label}`,
    message: hostCommands[id].message,
    label: `确认${card.label}`,
    focusKey: id,
    danger: card.priority === 'danger',
    shareReview: ['next', 'lobby'].includes(id),
    commit: () => {
      requireHostCard(id);
      record('host.commit', { command: id });
      hostCommands[id].apply();
    },
  });
}

for (let seatNumber = 1; seatNumber <= 12; seatNumber += 1) {
  const button = document.createElement('button');
  button.className = seatNumber === 6 ? 'seat self' : 'seat';
  button.type = 'button';
  button.dataset.seat = String(seatNumber);
  button.setAttribute('aria-label', `${seatNumber} 号${seatNumber === 6 ? '，你' : ''}`);
  const avatar = document.createElement('span');
  avatar.className = 'seat-avatar';
  avatar.textContent = String(seatNumber);
  const label = document.createElement('span');
  label.textContent = seatNumber === 6 ? '你' : `玩家 ${seatNumber}`;
  button.append(avatar, label);
  button.addEventListener('click', () => {
    state.target = seatNumber;
    render();
    if (!state.targeting) {
      phaseDescription.textContent = `已选择 ${seatNumber} 号，尚未提交，请从手牌选择技能。`;
    }
  });
  board.append(button);
}

document.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' &&
    !confirmation.open &&
    !detailDialog.open &&
    navigation.surface === null &&
    isHandOpen() &&
    navigation.trail.length > 0
  )
    backFace();
});
document.querySelector('#page-back').addEventListener('click', () => history.back());
window.addEventListener('popstate', (event) => {
  const previous = navigation.surface;
  const destination = event.state?.actionHandPage;
  if (previous?.kind === 'page') {
    navigation.surface = null;
    render();
    focusFace(previous.focusKey);
    record('page.back', { surface: previous.name });
  }
  if (destination !== null && destination !== undefined) {
    navigation.face = destination.face;
    navigation.trail = destination.trail;
    navigateFace(destination.name, destination.focusKey, { fromHistory: true });
  }
});
detailDialog.addEventListener('close', () => {
  const result = detailDialog.returnValue;
  detailDialog.returnValue = '';
  if (result === 'context-change') {
    record('surface.context-change');
    return;
  }
  const surface = navigation.surface;
  if (surface === null || surface.kind === 'page')
    fail('NO_OPEN_DIALOG', '关闭弹窗时没有对应的弹窗状态');
  navigation.surface = null;
  renderSurface();
  record('surface.close', { surface: surface.name, result });
  if (
    state.pendingHunterStatus &&
    state.game === 'werewolf' &&
    state.role === 'hunter' &&
    state.stage === 'night-action'
  ) {
    state.pendingHunterStatus = false;
    openSurface('hunter-status', null, false);
    return;
  }
  if (surface.name === 'mvp' && state.mvp !== '') focusFace(surface.focusKey);
});
document.querySelector('#confirm-target').addEventListener('click', () => {
  const target = state.target;
  if (target === null) fail('NO_TARGET', '必须先选择目标座位');
  askPlayerAction(null, `确定对 ${target} 号${roles[state.role].verb}？`, () => {
    if (state.role === 'wolf') {
      state.wolfVote = target;
      state.targeting = false;
      render();
    } else finishAction(`已对 ${target} 号${roles[state.role].verb}`);
  });
});
document.querySelector('#cancel-target').addEventListener('click', () => {
  state.targeting = false;
  render();
  openHand();
});
confirmation.addEventListener('close', () => {
  const committed = confirmation.returnValue === 'commit';
  const sharing = confirmation.returnValue === 'share';
  confirmation.returnValue = '';
  const pending = pendingConfirmation;
  pendingConfirmation = null;
  if (pending === null) fail('NO_PENDING_CONFIRMATION', '弹窗关闭时没有待确认操作');
  record(
    sharing ? 'confirmation.share' : committed ? 'confirmation.commit' : 'confirmation.cancel',
  );
  if (sharing) {
    if (!pending.shareReview) fail('SHARE_NOT_AVAILABLE', '当前确认操作不提供战报分享');
    requireHostCard(pending.focusKey);
    openSurface('review-share', pending.focusKey, false);
    return;
  }
  if (committed) {
    pending.commit();
    if (
      navigation.surface === null &&
      (state.stage !== pending.stage || (pending.targeting && !state.targeting))
    )
      openHand(false, state.stage !== pending.stage ? null : 'role-action');
  }
});
stageSelect.addEventListener('change', () => setStage(stageSelect.value));
document.querySelector('#host-view').addEventListener('change', (event) => {
  resetSurface();
  hideHand();
  state.host = event.target.checked;
  state.accountOpen = false;
  navigation.face = 'hand';
  navigation.trail = [];
  render();
  record('viewer.change');
});
for (const input of document.querySelectorAll('[name="scenario"]')) {
  input.addEventListener('change', () => {
    if (!Object.hasOwn(roles, input.value)) fail('UNKNOWN_ROLE', `未知模拟角色：${input.value}`);
    state.role = input.value;
    setStage(state.stage);
  });
}
document.querySelector('#reset').addEventListener('click', () => {
  state.viewedRole = false;
  state.reviewAllowedSeats = [];
  state.announced = false;
  state.mvp = '';
  state.lastAction = '';
  document.querySelector('#mvp-seat').value = '';
  document.querySelector('#prototype-error').hidden = true;
  setStage(state.stage);
});
document.querySelector('#account-trigger').addEventListener('click', () => {
  hideHand();
  state.accountOpen = true;
  render();
  document.querySelector('#account-title').focus();
  record('account.open', { origin: 'room-header' });
});
document.querySelector('#account-back').addEventListener('click', () => {
  state.accountOpen = false;
  render();
  document.querySelector('#account-trigger').focus();
  record('account.back');
});
document.querySelector('#personal-note').addEventListener('input', () => {
  state.savedNote = document.querySelector('#personal-note').value;
  document.querySelector('#note-feedback').textContent = '已自动保留在当前原型页面，刷新后清空。';
});
document.querySelector('#ack-hunter').addEventListener('click', () => {
  requirePlayerTurn();
  finishAction('已确认猎人发动状态');
  openHand();
});
document.querySelector('#ack-night-info').addEventListener('click', () => {
  requireHostCard('host-info');
  detailDialog.close('acknowledged');
  record('host.info-dismissed');
});
for (let seatNumber = 1; seatNumber <= 12; seatNumber += 1) {
  if (seatNumber === 6) continue;
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = String(seatNumber);
  label.append(input, document.createTextNode(`${seatNumber} 号`));
  document.querySelector('#grant-seats').append(label);
}
document.querySelector('#confirm-grant').addEventListener('click', () => {
  requireHostCard('grant');
  state.reviewAllowedSeats = [...document.querySelectorAll('#grant-seats input:checked')].map(
    (input) => Number(input.value),
  );
  record('host.grant', { seats: state.reviewAllowedSeats });
  detailDialog.close('commit');
});
document.querySelector('#mvp-seat').addEventListener('change', () => {
  document.querySelector('#confirm-mvp').disabled =
    document.querySelector('#mvp-seat').value === '';
});
document.querySelector('#confirm-mvp').addEventListener('click', () => {
  requireHostCard('mvp');
  const selected = document.querySelector('#mvp-seat').value;
  if (selected === '') fail('MVP_NOT_SELECTED', '确认 MVP 前必须选择座位');
  state.mvp = selected;
  renderCards();
  record('host.mvp', { seat: selected });
  detailDialog.close('commit');
});
for (const containerId of ['pregame-roles', 'detail-roles']) {
  const container = document.getElementById(containerId);
  for (const role of configuredRoles) {
    const button = document.createElement('button');
    button.className = 'configuration-role';
    button.textContent = `${role.name} ×${role.count}`;
    button.addEventListener('click', () => {
      document.querySelector('#role-explanation').textContent = `${role.name}：${role.description}`;
      if (containerId === 'pregame-roles') navigateFace('match-config', null);
      if (state.roleDesign === 'nested') {
        document.querySelector('#role-dialog-title').textContent = role.name;
        document.querySelector('#role-dialog-copy').textContent = role.description;
        roleDialog.showModal();
      } else {
        document.querySelector('#role-layout').classList.add('show-role');
        document.querySelector('#role-back').hidden = false;
      }
      record('configuration.role-preview', { role: role.name });
    });
    container.append(button);
  }
}
document.querySelector('#public-record-trigger').addEventListener('click', () => {
  navigateFace('public-records', null);
});
document.querySelector('#role-back').addEventListener('click', () => {
  document.querySelector('#role-layout').classList.remove('show-role');
  document.querySelector('#role-back').hidden = true;
  document.querySelector('#detail-roles button').focus();
});
for (const input of document.querySelectorAll('[name="role-design"]')) {
  input.addEventListener('change', () => {
    state.roleDesign = input.value;
    document.querySelector('#role-layout').classList.remove('show-role');
    document.querySelector('#role-back').hidden = true;
  });
}
for (const input of document.querySelectorAll('[name="host-indicator"]')) {
  input.addEventListener('change', () => {
    state.hostIndicator = input.value;
    renderCards();
  });
}
document.querySelector('#game-select').addEventListener('change', (event) => {
  state.game = event.target.value;
  const game = games[state.game];
  for (const option of stageSelect.options) {
    option.hidden = ['stage-game', 'reveal', 'aborted'].includes(option.value) && !game.stage;
    if (option.value === 'reveal')
      option.hidden = !['storyrelay', 'pictionary'].includes(state.game);
    if (option.value === 'aborted') option.hidden = state.game !== 'storyrelay';
    if (['assigned', 'night-audio', 'night-action', 'night-wait', 'day'].includes(option.value))
      option.hidden = game.stage;
    if (
      ['assigned', 'night-audio', 'night-action', 'night-wait'].includes(option.value) &&
      state.game !== 'werewolf'
    )
      option.hidden = true;
    if (option.value === 'day')
      option.textContent = state.game === 'werewolf' ? '白天 · 信息与复盘' : '游戏进行中';
  }
  setStage(game.stage ? 'stage-game' : state.game === 'werewolf' ? 'night-action' : 'day');
});
document.querySelector('#stage-menu-trigger').addEventListener('click', () => {
  state.menuOpen = true;
  navigation.face = 'menu';
  navigation.trail = [];
  render();
  focusFace();
});
document.querySelector('#reveal-next').addEventListener('click', () => {
  state.revealedPosition = Math.min(3, state.revealedPosition + 1);
  render();
});
document.querySelector('#reveal-previous').addEventListener('click', () => {
  state.revealedPosition = Math.max(1, state.revealedPosition - 1);
  render();
});
document.querySelector('#reveal-play').addEventListener('click', (event) => {
  state.revealPaused = !state.revealPaused;
  event.currentTarget.textContent = state.revealPaused ? '播放' : '暂停';
});
setInterval(() => {
  if (state.stage !== 'reveal' || state.revealPaused || state.revealedPosition >= 3) return;
  state.revealedPosition += 1;
  render();
}, 4000);
document.querySelector('#reveal-all').addEventListener('click', () => {
  askConfirmation({
    title: '全部揭晓？',
    message: '将向所有玩家展示剩余内容。',
    label: '确认全部揭晓',
    focusKey: null,
    commit: () => setStage('ended'),
  });
});
for (const field of document.querySelectorAll('#nomination-name, #nomination-reason')) {
  field.addEventListener('input', () => {
    state.nominationDirty = true;
  });
}
document.querySelector('#simulate-deal').addEventListener('click', () => {
  state.stage = 'assigned';
  document.querySelector('#nomination-closed').hidden = false;
  document.querySelector('#submit-nomination').disabled = true;
  document.querySelector('#simulate-deal').disabled = true;
  render();
});
document.querySelector('#simulate-hunter-turn').addEventListener('click', () => {
  state.role = 'hunter';
  document.querySelector('[name="scenario"][value="hunter"]').checked = true;
  state.stage = 'night-action';
  state.pendingHunterStatus = true;
  state.lastAction = '';
  render();
  record('simulation.hunter-status-queued');
});
document.querySelector('#stage-draft').addEventListener('input', (event) => {
  state.drafts[state.game] = event.currentTarget.value;
});
for (const button of document.querySelectorAll('#stage-match button')) {
  button.addEventListener('click', () => {
    document.querySelector('#stage-match-feedback').textContent =
      `已选择${button.textContent}（仅演示，不判断结果）。`;
  });
}
document.querySelector('#submit-nomination').addEventListener('click', () => {
  if (state.stage !== 'lobby') fail('NOMINATION_CLOSED', '已发牌，不能提交建议');
  state.nominations = [
    {
      name: document.querySelector('#nomination-name').value.trim(),
      reason: document.querySelector('#nomination-reason').value.trim(),
    },
  ];
  state.nominationDirty = false;
  detailDialog.close('submitted');
  render();
});
function requestDetailClose(event) {
  if (navigation.surface?.name === 'hunter-status') {
    event.preventDefault();
    return;
  }
  if (navigation.surface?.name !== 'nomination' || !state.nominationDirty) return;
  event.preventDefault();
  discardDialog.showModal();
}
detailDialog.addEventListener('cancel', requestDetailClose);
detailDialog.querySelector('.detail-header form').addEventListener('submit', requestDetailClose);
document
  .querySelector('#keep-editing')
  .addEventListener('click', () => discardDialog.close('keep'));
document.querySelector('#discard-editing').addEventListener('click', () => {
  state.nominationDirty = false;
  discardDialog.close('discard');
  detailDialog.close('discard');
});
render();
record('prototype.ready');
