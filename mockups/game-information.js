const gameSelect = document.querySelector('#game-select');
const phaseSelect = document.querySelector('#phase-select');
const title = document.querySelector('#game-title');
const phaseContext = document.querySelector('#phase-context');
const phaseTitle = document.querySelector('#phase-title');
const phaseDescription = document.querySelector('#phase-description');
const setupInfo = document.querySelector('#setup-info');
const tracks = document.querySelector('#tracks');
const latestResult = document.querySelector('#latest-result');
const board = document.querySelector('#board');
const detailDialog = document.querySelector('#detail-dialog');
const detailTitle = document.querySelector('#detail-title');
const detailContent = document.querySelector('#detail-content');
const resultDialog = document.querySelector('#result-dialog');
const resultTitle = document.querySelector('#result-title');
const resultCopy = document.querySelector('#result-copy');
const resultSeconds = document.querySelector('#result-seconds');
const actionLabel = document.querySelector('#action-label');
const selectedSeats = new Set();
let resultTimer = null;

const policyRules = [
  ['第 1 张', '本示例为 7 人局，第 1 张法西斯政策没有总统权力。'],
  ['调查', '第 2 张法西斯政策生效后，总统调查一名玩家的阵营。查验结果仅总统可见。'],
  ['选举', '第 3 张法西斯政策生效后，总统指定下一任总统。此后希特勒当选总理将立即获胜。'],
  ['处决', '第 4 张法西斯政策生效后，总统处决一名玩家。'],
  ['处决', '第 5 张法西斯政策生效后，总统处决一名玩家，并解锁政策否决权。'],
  ['胜利', '第 6 张法西斯政策生效后，法西斯阵营获胜。'],
];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function showDetail(heading, text) {
  detailTitle.textContent = heading;
  detailContent.replaceChildren(element('p', '', text));
  detailDialog.showModal();
}

function trackHeading(name, summary) {
  const heading = element('div', 'track-heading');
  heading.append(element('h3', '', name), element('span', '', summary));
  return heading;
}

function renderAvalonTrack(ended) {
  const list = element('ol', 'mission-track');
  list.setAttribute('role', 'list');
  const sizes = [2, 3, 3, 4, 4];
  const states = ended
    ? ['success', 'failure', 'success', 'failure', 'success']
    : ['success', 'failure', 'current', 'upcoming', 'upcoming'];
  const labels = {
    success: '成功',
    failure: '失败',
    current: '进行中',
    upcoming: '待开始',
  };
  sizes.forEach((size, index) => {
    const cell = element('li', 'track-cell');
    cell.dataset.state = states[index];
    cell.append(
      element('strong', '', `第${index + 1}轮`),
      element('span', '', `${size}人`),
      element('span', '', labels[states[index]]),
    );
    if (index === 3) cell.append(element('span', '', '2败失败'));
    list.append(cell);
  });
  tracks.append(trackHeading('任务轨道', ended ? '最终结果' : '7 人局'), list);
  const attempts = element('ol', 'attempt-track');
  attempts.setAttribute('aria-label', '组队次数');
  for (let index = 1; index <= 5; index += 1) {
    const cell = element('li', 'track-cell');
    cell.dataset.state = index === 1 ? 'failure' : !ended && index === 2 ? 'current' : 'upcoming';
    cell.append(
      element('strong', '', `第${index}次`),
      element('span', '', index === 1 ? '已否决' : !ended && index === 2 ? '当前' : '未到'),
    );
    if (index === 5) cell.append(element('span', '', '自动通过'));
    attempts.append(cell);
  }
  tracks.append(trackHeading('组队次数', '最后一次提交自动通过'), attempts);
}

function renderPolicyTrack(ended) {
  const liberal = element('ol', 'policy-track');
  liberal.style.setProperty('--track-size', '5');
  liberal.setAttribute('role', 'list');
  for (let index = 0; index < 5; index += 1) {
    const cell = element('li', 'track-cell');
    const enacted = index < (ended ? 5 : 2);
    if (enacted) cell.dataset.state = 'liberal';
    cell.append(
      element('strong', '', `${index + 1}`),
      element(
        'span',
        '',
        index === 4 ? (enacted ? '已胜利' : '胜利') : enacted ? '已施行' : '待施行',
      ),
    );
    liberal.append(cell);
  }
  const fascist = element('ol', 'policy-track');
  fascist.style.setProperty('--track-size', '6');
  fascist.setAttribute('role', 'list');
  policyRules.forEach(([label, explanation], index) => {
    const item = document.createElement('li');
    const button = element('button', 'policy-cell');
    button.type = 'button';
    if (index < 3) button.dataset.state = 'fascist';
    button.append(element('strong', '', `${index + 1}`), element('span', '', label));
    button.setAttribute('aria-label', `第 ${index + 1} 张法西斯政策：${label}，查看说明`);
    button.addEventListener('click', () =>
      showDetail(`法西斯政策 ${index + 1} · ${label}`, explanation),
    );
    item.append(button);
    fascist.append(item);
  });
  const electionTrack = element('ol', 'election-track');
  electionTrack.setAttribute('aria-label', '选举失败轨道');
  for (let index = 1; index <= 3; index += 1) {
    const cell = element('li', 'track-cell');
    cell.dataset.state = index === 1 ? 'failure' : 'upcoming';
    cell.append(element('strong', '', index === 3 ? '混乱' : `第${index}次`));
    electionTrack.append(cell);
  }
  tracks.append(
    trackHeading('自由派政策', `${ended ? 5 : 2}/5`),
    liberal,
    trackHeading('法西斯政策', '3/6 · 点击格子查看规则'),
    fascist,
    trackHeading('选举失败', '1/3 · 第三次自动施行政策'),
    electionTrack,
  );
}

function renderBoard() {
  board.replaceChildren();
  const active = phaseSelect.value === 'playing' || phaseSelect.value === 'result';
  for (let seat = 1; seat <= 7; seat += 1) {
    const button = element('button', `seat${seat === 1 ? ' self' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(selectedSeats.has(seat)));
    button.append(
      element('span', 'seat-avatar', String(seat)),
      element('span', '', seat === 1 ? (active ? '你 · 组队者' : '你') : `${seat} 号玩家`),
    );
    if (gameSelect.value === 'hitler' && seat === 1 && active)
      button.lastChild.textContent = '你 · 总统';
    if (gameSelect.value === 'hitler' && seat === 2 && active) {
      button.lastChild.textContent += ' · 预选';
    }
    button.addEventListener('click', () => {
      if (selectedSeats.has(seat)) selectedSeats.delete(seat);
      else selectedSeats.add(seat);
      button.setAttribute('aria-pressed', String(selectedSeats.has(seat)));
    });
    board.append(button);
  }
}

function renderRoom() {
  const avalon = gameSelect.value === 'avalon';
  const phase = phaseSelect.value;
  const setup = phase === 'setup';
  const ended = phase === 'ended';
  title.textContent = avalon ? '阿瓦隆' : '秘密希特勒';
  phaseContext.textContent = setup
    ? '待开局'
    : ended
      ? '本局结束'
      : avalon
        ? '第三轮 · 第 2 次提案'
        : '选举阶段';
  phaseTitle.textContent = setup
    ? '等待房主分配角色'
    : ended
      ? avalon
        ? '好人获胜'
        : '自由派获胜'
      : avalon
        ? '队长正在组队'
        : '总统正在确定最终总理';
  phaseDescription.textContent = setup
    ? '开局前可查看本局角色配置。'
    : ended
      ? '完整记录和身份结果可在对局记录中查看。'
      : avalon
        ? '本轮需要 3 名队员。'
        : '预选已公开，最终提名后进入投票。';
  actionLabel.textContent = setup ? '分配角色' : ended ? '本局复盘' : avalon ? '组队' : '最终提名';
  document.querySelector('#history-button').hidden = setup;
  document.querySelector('#configuration-button').hidden = setup;
  document.querySelector('.card-row').style.setProperty('--card-count', setup ? '2' : '4');
  setupInfo.hidden = !setup;
  tracks.hidden = setup;
  latestResult.hidden = setup;
  setupInfo.replaceChildren();
  tracks.replaceChildren();
  if (setup) {
    const roleList = element('div', 'setup-roles');
    const roles = avalon
      ? ['梅林', '派西维尔', '忠臣 ×2', '刺客', '莫甘娜', '奥伯伦']
      : ['自由派 ×4', '法西斯 ×2', '希特勒'];
    roles.forEach((role) => roleList.append(element('span', '', role)));
    setupInfo.append(element('h3', '', `${title.textContent} · 7 人`), roleList);
  } else {
    if (avalon) renderAvalonTrack(ended);
    else renderPolicyTrack(ended);
    latestResult.textContent = ended
      ? '最近结果 · 本局已结束'
      : avalon
        ? '最近结果 · 第二轮任务失败'
        : '最近结果 · 第三张法西斯政策已施行';
  }
  renderBoard();
}

function stopResultTimer() {
  if (resultTimer !== null) clearInterval(resultTimer);
  resultTimer = null;
}

function showResult() {
  const restoreDetail = detailDialog.open;
  if (restoreDetail) detailDialog.close();
  let seconds = 5;
  resultTitle.textContent = gameSelect.value === 'avalon' ? '任务失败' : '政策已施行';
  resultCopy.textContent =
    gameSelect.value === 'avalon' ? '第二轮任务失败 · 1 张失败牌' : '法西斯政策 +1 · 解锁特别选举';
  resultSeconds.textContent = String(seconds);
  resultDialog.showModal();
  resultTimer = setInterval(() => {
    seconds -= 1;
    resultSeconds.textContent = String(seconds);
    if (seconds === 0) {
      stopResultTimer();
      resultDialog.close();
      phaseSelect.value = 'playing';
      renderRoom();
      if (restoreDetail) detailDialog.showModal();
    }
  }, 1000);
}

resultDialog.addEventListener('cancel', (event) => event.preventDefault());
document.querySelector('#simulate-result').addEventListener('click', () => {
  phaseSelect.value = 'result';
  renderRoom();
  showResult();
});
gameSelect.addEventListener('change', () => {
  selectedSeats.clear();
  renderRoom();
});
phaseSelect.addEventListener('change', () => {
  renderRoom();
  if (phaseSelect.value === 'result') showResult();
});
document.querySelector('#history-button').addEventListener('click', () => {
  showDetail(
    '对局记录',
    gameSelect.value === 'avalon'
      ? '第一轮任务成功；第二轮任务失败。完整记录展示历轮提案、投票和任务结果。'
      : '本局已施行 2 张自由派政策和 3 张法西斯政策。完整记录展示政府、投票和公开行动。',
  );
});
document.querySelector('#configuration-button').addEventListener('click', () => {
  showDetail('本局配置', '7 人示例 · 此处保留原有的角色构成和游戏设置。');
});
document.querySelector('#manual-button').addEventListener('click', () => {
  showDetail('手册', '玩法与攻略仍通过原有手册入口查看。');
});
document.querySelector('#action-button').addEventListener('click', () => {
  showDetail('模拟操作', '点击座位可以模拟未提交的选择。查看说明和记录后，选择仍会保留。');
});
renderRoom();
