import { act, renderHook } from '@testing-library/react';

import { useKeyboardHeight } from '../useKeyboardHeight';

class TestVisualViewport extends EventTarget {
  height = 852;
  offsetTop = 0;
}

let viewport: TestVisualViewport;

beforeEach(() => {
  viewport = new TestVisualViewport();
  vi.stubGlobal('innerHeight', 852);
  vi.stubGlobal('visualViewport', viewport);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('measures an already-open keyboard and accounts for visual viewport scrolling', () => {
  viewport.height = 500;
  const { result } = renderHook(() => useKeyboardHeight());
  expect(result.current).toBe(352);

  act(() => {
    viewport.offsetTop = 20;
    viewport.dispatchEvent(new Event('scroll'));
  });
  expect(result.current).toBe(332);
});

it('does not count a shrinking layout viewport as additional keyboard overlap', () => {
  const { result } = renderHook(() => useKeyboardHeight());

  act(() => {
    vi.stubGlobal('innerHeight', 500);
    viewport.height = 500;
    viewport.dispatchEvent(new Event('resize'));
  });
  expect(result.current).toBe(0);

  act(() => {
    viewport.height = 300;
    viewport.dispatchEvent(new Event('resize'));
  });
  expect(result.current).toBe(200);
});

it('recalculates overlap on layout resize without waiting for a visual viewport event', () => {
  viewport.height = 500;
  const { result } = renderHook(() => useKeyboardHeight());

  act(() => {
    vi.stubGlobal('innerHeight', 600);
    window.dispatchEvent(new Event('resize'));
  });
  expect(result.current).toBe(100);
});
