/** Fades out the static boot splash from index.html, then removes it. */
export function dismissBootSplash(): void {
  const splash = document.getElementById('boot-splash');
  if (splash === null) throw new Error('index.html is missing #boot-splash');
  splash.addEventListener('transitionend', (event) => {
    if (event.target === splash) splash.remove();
  });
  splash.classList.add('boot-splash-leaving');
}

/** Dismisses after a paint when possible, with a timer fallback if animation frames are paused. */
export function scheduleBootSplashDismiss(): void {
  let dismissed = false;
  let fallbackTimer = 0;
  const dismissOnce = (): void => {
    if (dismissed) return;
    dismissed = true;
    window.clearTimeout(fallbackTimer);
    dismissBootSplash();
  };

  fallbackTimer = window.setTimeout(dismissOnce, 1000);
  window.requestAnimationFrame(dismissOnce);
}
