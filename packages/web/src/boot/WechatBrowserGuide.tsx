import './WechatBrowserGuide.css';

/** Shown in WeChat's in-app browser: the app runs in the mini-program or a real browser only. */
export function WechatBrowserGuide() {
  return (
    <main className="wechat-guide">
      <span className="wechat-guide-arrow" aria-hidden>
        ↗
      </span>
      <span className="wechat-guide-icon" aria-hidden>
        🌐
      </span>
      <h1 className="wechat-guide-title">请使用浏览器打开</h1>
      <p className="wechat-guide-desc">微信内置浏览器功能受限，请使用外部浏览器以获得最佳体验</p>
      <ol className="wechat-guide-steps">
        <li>
          点击右上角 <strong>⋯</strong> 菜单
        </li>
        <li>
          选择「<strong>在浏览器中打开</strong>」
        </li>
      </ol>
    </main>
  );
}
