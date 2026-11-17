/* global document, matchMedia */
function animateFeedback(phone, kind) {
  phone.querySelector('.effect-layer')?.remove();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (kind !== 'success' && kind !== 'other') return;

  const layer = document.createElement('div');
  layer.className = 'effect-layer';
  layer.setAttribute('aria-hidden', 'true');
  phone.append(layer);
  const phoneBounds = phone.getBoundingClientRect();
  const central = phone.querySelector('[data-kind="central"]');
  const bounds = central.getBoundingClientRect();
  const centerX = bounds.left + bounds.width / 2 - phoneBounds.left;
  const centerY = bounds.top + bounds.height / 2 - phoneBounds.top;
  const variant = phone.closest('.variant').dataset.variant;

  if (variant === 'a') {
    phone.querySelectorAll('.is-match').forEach((symbol) => {
      const box = symbol.getBoundingClientRect();
      const orbit = document.createElement('span');
      orbit.className = 'match-orbit';
      orbit.style.cssText = `left:${box.left - phoneBounds.left}px;top:${box.top - phoneBounds.top}px;width:${box.width}px;height:${box.height}px`;
      layer.append(orbit);
      orbit.animate(
        [
          { scale: '.85', opacity: 0.9 },
          { scale: '1.8', opacity: 0 },
        ],
        { duration: 720, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' },
      );
    });
  } else {
    const stamp = document.createElement('div');
    stamp.className = 'stamped-word';
    stamp.textContent = kind === 'other' ? 'NICE!' : variant === 'b' ? 'PLAYED' : 'GOT IT!';
    stamp.style.left = `${centerX}px`;
    stamp.style.top = `${centerY + (variant === 'c' ? 45 : 0)}px`;
    layer.append(stamp);
    stamp.animate(
      [
        { scale: '1.7', opacity: 0 },
        { scale: '1.7', opacity: 0, offset: variant === 'b' ? 0.6 : 0.12 },
        { scale: '.94', opacity: 1, offset: variant === 'b' ? 0.75 : 0.3 },
        { scale: '1', opacity: 1, offset: 0.86 },
        { scale: '1.03', opacity: 0 },
      ],
      { duration: 1000, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' },
    );
  }

  const rayCount = variant === 'b' ? 0 : 10;
  for (let index = 0; index < rayCount; index += 1) {
    const angle = (index * Math.PI * 2) / rayCount;
    const ray = document.createElement('i');
    ray.className = 'burst-ray';
    ray.style.cssText = `left:${centerX}px;top:${centerY}px;rotate:${angle + Math.PI / 2}rad`;
    layer.append(ray);
    const radius = bounds.width * 0.42;
    ray.animate(
      [
        {
          translate: `${Math.cos(angle) * radius}px ${Math.sin(angle) * radius}px`,
          opacity: 0,
          scale: '.3',
        },
        {
          translate: `${Math.cos(angle) * (radius + 12)}px ${Math.sin(angle) * (radius + 12)}px`,
          opacity: 1,
          scale: '1',
          offset: 0.3,
        },
        {
          translate: `${Math.cos(angle) * (radius + 34)}px ${Math.sin(angle) * (radius + 34)}px`,
          opacity: 0,
          scale: '.5',
        },
      ],
      { duration: 800, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' },
    );
  }
}

document.addEventListener('feedback', (event) => {
  animateFeedback(event.target, event.detail.kind);
});
