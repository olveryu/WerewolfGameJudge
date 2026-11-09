import './WechatLoginEntry.css';

import { Button } from '@/components/Button';
import { getOrCreateClaimNonce, wxReLaunchWithNonce } from '@/utils/miniProgram';

import splashArt from '../../../../../assets/pwa/web/splash-wolf-blue.webp';

/**
 * Mini-program login entry, shown instead of the app while the WeChat claim flow needs the user:
 * 进入游戏 relaunches the mini-program with a nonce so its native side completes the login.
 */
export function WechatLoginEntry() {
  return (
    <main className="wechat-entry">
      <img className="wechat-entry-art" src={splashArt} alt="" />
      <span className="wechat-entry-shade" />
      <div className="wechat-entry-title">
        <h1>狼 人 杀</h1>
        <span className="wechat-entry-divider" />
        <span className="wechat-entry-subtitle">电 子 裁 判</span>
      </div>
      <div className="wechat-entry-bottom">
        <Button onClick={() => wxReLaunchWithNonce(getOrCreateClaimNonce())}>进入游戏</Button>
        <p className="wechat-entry-hint">首次使用需要初始化，请稍等</p>
      </div>
    </main>
  );
}
