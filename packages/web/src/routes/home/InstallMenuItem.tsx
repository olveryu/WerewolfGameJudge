import './InstallMenuItem.css';

import { useState } from 'react';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { usePWAInstall } from '@/features/home/usePWAInstall';
import { handleError } from '@/utils/errorPipeline';
import { homeLog } from '@/utils/logger';
import IconDownloadOutline from '~icons/ion/download-outline';
import IconShareOutline from '~icons/ion/share-outline';

const STEP_NUMBERS = ['①', '②', '③'] as const;

function ShareIcon() {
  return <IconShareOutline className="install-guide-share" aria-label="分享" role="img" />;
}

const CHROME_STEPS = [
  <>
    点击右上角 <ShareIcon /> 分享按钮
  </>,
  <>选择「添加到主屏幕」</>,
  <>点击「添加」确认</>,
];

const SAFARI_STEPS = [
  <>
    点击底部工具栏的 <ShareIcon /> 分享按钮
  </>,
  <>滚动菜单，找到「添加到主屏幕」</>,
  <>点击右上角「添加」确认</>,
];

/** Home footer entry that installs the web app, or explains the manual steps on iOS. */
export function InstallMenuItem() {
  const { mode, iosBrowser, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (mode === 'hidden') return null;

  const handleClick = () => {
    if (mode === 'ios-guide') {
      setGuideOpen(true);
      return;
    }
    install().catch((error: unknown) => {
      handleError(error, { label: '安装到主屏幕', logger: homeLog, feedback: 'toast' });
    });
  };

  const steps = iosBrowser === 'chrome' ? CHROME_STEPS : SAFARI_STEPS;

  return (
    <>
      <button type="button" className="install-menu-item" onClick={handleClick}>
        <IconDownloadOutline aria-hidden="true" />
        安装到主屏幕
      </button>
      <CenterDialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="添加到主屏幕"
        subtitle="按以下步骤操作，即可像 App 一样使用"
      >
        <ol className="install-guide-steps">
          {steps.map((step, index) => (
            <li key={STEP_NUMBERS[index]} className="install-guide-step">
              <span className="install-guide-number" aria-hidden="true">
                {STEP_NUMBERS[index]}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="center-dialog-actions">
          <Button onClick={() => setGuideOpen(false)}>知道了</Button>
        </div>
      </CenterDialog>
    </>
  );
}
