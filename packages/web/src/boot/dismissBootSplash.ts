/** Fades out the static boot splash from index.html, then removes it. */
export function dismissBootSplash(): void {
  const splash = document.getElementById('boot-splash');
  if (splash === null) throw new Error('index.html is missing #boot-splash');
  splash.addEventListener('transitionend', (event) => {
    if (event.target === splash) splash.remove();
  });
  splash.classList.add('boot-splash-leaving');
}
