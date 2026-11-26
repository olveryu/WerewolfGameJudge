import 'pixi.js/unsafe-eval';

import { createRoot } from 'react-dom/client';

import { applyAvatarShapeTokens } from '@/config/avatarShape';
import { applyColorTokens } from '@/theme/colors';

import { PreviewApp, PreviewScreen, readPreviewScreenParameters } from './PreviewApp';

window.fetch = async () => {
  throw new Error('离线预览禁止网络请求');
};

applyColorTokens(document.documentElement);
applyAvatarShapeTokens(document.documentElement);
const root = document.getElementById('root');
if (root === null) throw new Error('预览页面缺少根节点');
const embedded = new URLSearchParams(window.location.search).has('embedded');
createRoot(root).render(
  embedded ? (
    <PreviewScreen {...readPreviewScreenParameters(window.location.search)} />
  ) : (
    <PreviewApp />
  ),
);
