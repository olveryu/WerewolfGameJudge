import type { KeyboardEvent } from 'react';

/** Moves focus and activates the next horizontal tab for arrow, Home, and End keys. */
export function handleHorizontalTabKeyDown(event: KeyboardEvent<HTMLElement>) {
  const { key } = event;
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;

  const target = event.target;
  if (!(target instanceof Element)) return;
  const currentTrigger = target.closest<HTMLElement>('[role="tab"]');
  if (currentTrigger === null) return;

  const triggers = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'),
  );
  const currentIndex = triggers.indexOf(currentTrigger);
  if (currentIndex < 0 || triggers.length === 0) return;

  let nextIndex: number;
  if (key === 'Home') {
    nextIndex = 0;
  } else if (key === 'End') {
    nextIndex = triggers.length - 1;
  } else {
    const rightOffset = window.getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1;
    const offset = key === 'ArrowRight' ? rightOffset : -rightOffset;
    nextIndex = (currentIndex + offset + triggers.length) % triggers.length;
  }

  event.preventDefault();
  const nextTrigger = triggers[nextIndex];
  nextTrigger?.focus();
  nextTrigger?.click();
}
