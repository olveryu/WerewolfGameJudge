/* global document, history, location, window */
import { galleryView } from './gallery.js';
import { pageGroups, pageView } from './views.js';

const groups = pageGroups();
const pages = new Map(
  groups.flatMap((group) => group.pages.map(([id, title]) => [id, { title, group: group.title }])),
);
const preview = document.querySelector('#preview');
const navigation = document.querySelector('#navigation');
const dialogNavigation = document.querySelector('#dialog-navigation');
const dialog = document.querySelector('#page-dialog');
const compareButton = document.querySelector('#compare-button');
const title = document.querySelector('#preview-title');
const category = document.querySelector('#preview-category');
const description = document.querySelector('#preview-description');
const viewport = document.querySelector('#viewport');
let currentPage = pages.has(location.hash.slice(1)) ? location.hash.slice(1) : 'gallery';
let roomState = 'playing';
let comparing = false;

function navMarkup() {
  return groups
    .map(
      (group) =>
        `<details class="nav-group" ${group.title === pages.get(currentPage).group || group.title === '设计方案' ? 'open' : ''}><summary>${group.title}</summary>${group.pages.map(([id, label]) => `<button type="button" class="nav-item" data-page="${id}" ${id === currentPage ? 'aria-current="page"' : ''}>${label}</button>`).join('')}</details>`,
    )
    .join('');
}

function render() {
  const page = pages.get(currentPage);
  if (!page) throw new Error(`Unknown mock page: ${currentPage}`);
  title.textContent = page.title;
  category.textContent = page.group;
  description.textContent =
    currentPage === 'gallery'
      ? '多种实体语言并排比较。各页面采用当前推荐方向，后续可混搭调整。'
      : '设计探索：内容与操作均为模拟，不连接正式服务。';
  preview.classList.toggle('gallery', currentPage === 'gallery');
  preview.classList.toggle('wide', viewport.value === 'wide');
  const baseline = {
    home: 'home.png',
    'room-werewolf': 'room-werewolf.png',
    'admin-overview': 'admin-overview.png',
  }[currentPage];
  if (comparing && baseline) {
    preview.innerHTML = `<div class="baseline"><p>main 实际截图（本地示例数据）${currentPage === 'room-werewolf' ? ' · 待开局' : ''}</p><img src="./baselines/${baseline}" alt="main 页面实际截图"></div>`;
  } else {
    preview.innerHTML =
      currentPage === 'gallery' ? galleryView() : pageView(currentPage, roomState);
  }
  navigation.innerHTML = navMarkup();
  dialogNavigation.innerHTML = navMarkup();
  const comparable = Boolean(baseline);
  compareButton.hidden = !comparable;
  compareButton.setAttribute('aria-pressed', String(comparing));
  compareButton.textContent = comparing ? '返回新版' : '查看 main 截图';
}

function go(page) {
  if (!pages.has(page)) throw new Error(`Unknown mock page: ${page}`);
  currentPage = page;
  roomState = 'playing';
  comparing = false;
  history.pushState(null, '', `#${page}`);
  if (dialog.open) dialog.close();
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function showExampleDialog(sheet = false) {
  const existing = document.querySelector('#example-dialog');
  if (existing) existing.remove();
  const example = document.createElement('dialog');
  example.id = 'example-dialog';
  example.className = sheet ? 'example-dialog sheet' : 'example-dialog';
  example.innerHTML = `<form method="dialog"><div class="dialog-heading"><div><span class="panel-label">确认操作</span><h3>${sheet ? '房间操作' : '确认继续？'}</h3></div><button class="close-button" aria-label="关闭">×</button></div><p>这是一个模拟界面，不会执行真实操作。</p><div class="row spaced"><button class="key secondary" value="cancel">取消</button><button class="key" value="confirm">确认</button></div></form>`;
  document.body.append(example);
  example.addEventListener('close', () => example.remove(), { once: true });
  example.showModal();
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.page) {
    go(target.dataset.page);
    return;
  }
  const action = target.dataset.action;
  if (!action) return;
  if (action.startsWith('open-room-')) {
    go(`room-${action.slice(10)}`);
    return;
  }
  if (action.startsWith('open-guide-')) {
    go(`guide-${action.slice(11)}`);
    return;
  }
  if (action.startsWith('open-config-')) {
    go(`config-${action.slice(12)}`);
    return;
  }
  if (action === 'home') {
    go('home');
    return;
  }
  if (action === 'role') {
    go(`role-${currentPage.slice(5)}`);
    return;
  }
  if (action === 'switch') {
    target.setAttribute('aria-checked', String(target.getAttribute('aria-checked') !== 'true'));
    return;
  }
  if (['seat', 'select-hand', 'select-tile'].includes(action)) {
    target.setAttribute('aria-pressed', String(target.getAttribute('aria-pressed') !== 'true'));
    return;
  }
  if (action === 'dialog' || action === 'sheet' || action === 'menu' || action === 'sample')
    showExampleDialog(action === 'sheet');
});

document.querySelector('#menu-button').addEventListener('click', () => dialog.showModal());
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const activeDialog = document.querySelector('dialog:modal');
  if (activeDialog) {
    event.preventDefault();
    activeDialog.close();
  }
});
viewport.addEventListener('change', render);
compareButton.addEventListener('click', () => {
  comparing = !comparing;
  render();
});
preview.addEventListener('change', (event) => {
  if (event.target.id === 'room-state') {
    roomState = event.target.value;
    render();
  }
});
window.addEventListener('popstate', () => {
  const page = location.hash.slice(1);
  currentPage = pages.has(page) ? page : 'gallery';
  comparing = false;
  render();
});
render();
