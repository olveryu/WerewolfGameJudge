/**
 * @jest-environment jsdom
 *
 * Single shared visualViewport source: one keyboard event, one inset.
 *
 * The task frame and the AI chat bubble used to own three separate
 * visualViewport listeners; this pins that the shared module registers
 * exactly one `resize` + one `scroll` listener no matter how many
 * consumers mount, that one event reaches every consumer with the same
 * snapshot, and that the listeners go away once the last consumer
 * unmounts. Pure inset math is covered without any DOM.
 *
 * Out of scope (real device only): whether WeChat's web-view actually
 * fires these events with the assumed heights.
 */

// Force the web backend: the hooks evaluate `Platform.OS === 'web'` at render.
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useKeyboardHeight } from '../useKeyboardHeight';
import {
  computeContainerInset,
  computeKeyboardHeight,
  useVisualViewport,
  type VisualViewportSnapshot,
} from '../useVisualViewport';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeVisualViewport extends EventTarget {
  height: number;
  offsetTop: number;

  constructor(height: number, offsetTop: number) {
    super();
    this.height = height;
    this.offsetTop = offsetTop;
  }

  resizeTo(height: number, offsetTop: number): void {
    this.height = height;
    this.offsetTop = offsetTop;
    this.dispatchEvent(new Event('resize'));
  }

  scrollTo(offsetTop: number): void {
    this.offsetTop = offsetTop;
    this.dispatchEvent(new Event('scroll'));
  }
}

describe('computeKeyboardHeight / computeContainerInset', () => {
  it('clamps at zero and ignores the viewport pan', () => {
    // Coordinate basis: `measureInWindow` returns `getBoundingClientRect`
    // values, already in visual viewport coordinates, so the pan offset
    // must not be subtracted a second time. The keyboard only shrinks
    // the visual viewport, and panning it changes neither its height
    // nor the container's overhang below its bottom edge.
    expect(computeKeyboardHeight(800, { height: 500, offsetTop: 0 })).toBe(300);
    expect(computeKeyboardHeight(800, { height: 500, offsetTop: 50 })).toBe(300);
    expect(computeKeyboardHeight(800, { height: 800, offsetTop: 0 })).toBe(0);
    expect(computeKeyboardHeight(800, { height: 900, offsetTop: 0 })).toBe(0);
    expect(computeContainerInset(700, { height: 500, offsetTop: 0 })).toBe(200);
    expect(computeContainerInset(700, { height: 500, offsetTop: 50 })).toBe(200);
    expect(computeContainerInset(400, { height: 500, offsetTop: 0 })).toBe(0);
    expect(computeContainerInset(400, { height: 500, offsetTop: 50 })).toBe(0);
  });
});

describe('useVisualViewport shared subscription', () => {
  let fake: FakeVisualViewport;
  let roots: ReactTestRenderer[];

  beforeEach(() => {
    fake = new FakeVisualViewport(800, 0);
    Object.defineProperty(window, 'visualViewport', {
      value: fake,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    roots = [];
  });

  afterEach(() => {
    for (const root of roots) {
      act(() => {
        root.unmount();
      });
    }
    roots = [];
    Object.defineProperty(window, 'visualViewport', {
      value: undefined,
      configurable: true,
    });
  });

  it('registers one resize + one scroll listener for two consumers', () => {
    const addSpy = jest.spyOn(fake, 'addEventListener');
    const removeSpy = jest.spyOn(fake, 'removeEventListener');
    const seen: Array<{ snapshot: VisualViewportSnapshot | null; height: number }> = [];
    const Probe = () => {
      const snapshot = useVisualViewport();
      const height = useKeyboardHeight();
      seen.push({ snapshot, height });
      return null;
    };
    let first!: ReactTestRenderer;
    let second!: ReactTestRenderer;
    act(() => {
      first = create(<Probe />);
      second = create(<Probe />);
    });
    roots.push(first, second);

    expect(addSpy.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1);
    expect(addSpy.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(1);
    expect(seen.at(-1)).toEqual({ snapshot: { height: 800, offsetTop: 0 }, height: 0 });

    // One keyboard event reaches both consumers with the same snapshot.
    act(() => {
      fake.resizeTo(500, 0);
    });
    expect(seen.at(-1)).toEqual({ snapshot: { height: 500, offsetTop: 0 }, height: 300 });

    // A no-op event (same geometry) notifies nobody: no extra render.
    const rendersBefore = seen.length;
    act(() => {
      fake.resizeTo(500, 0);
    });
    expect(seen).toHaveLength(rendersBefore);

    // The pan offset is part of the snapshot, not a second event source.
    // It changes neither the keyboard height nor the container inset.
    act(() => {
      fake.scrollTo(50);
    });
    expect(seen.at(-1)).toEqual({ snapshot: { height: 500, offsetTop: 50 }, height: 300 });

    act(() => {
      first.unmount();
    });
    expect(removeSpy).not.toHaveBeenCalled();
    act(() => {
      second.unmount();
    });
    expect(removeSpy.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1);
    expect(removeSpy.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(1);
    roots = [];
  });

  it('derives the bubble keyboard height from the shared snapshot', () => {
    const heights: number[] = [];
    const Probe = () => {
      heights.push(useKeyboardHeight());
      return null;
    };
    let root!: ReactTestRenderer;
    act(() => {
      root = create(<Probe />);
    });
    roots.push(root);
    expect(heights.at(-1)).toBe(0);
    act(() => {
      fake.resizeTo(450, 0);
    });
    expect(heights.at(-1)).toBe(350);
    act(() => {
      fake.resizeTo(800, 0);
    });
    expect(heights.at(-1)).toBe(0);
  });
});

describe('pan reset', () => {
  let fake: FakeVisualViewport;
  let roots: ReactTestRenderer[];
  let input: HTMLInputElement;

  beforeEach(() => {
    fake = new FakeVisualViewport(800, 0);
    Object.defineProperty(window, 'visualViewport', {
      value: fake,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    input = document.createElement('input');
    document.body.appendChild(input);
    roots = [];
  });

  afterEach(() => {
    for (const root of roots) {
      act(() => {
        root.unmount();
      });
    }
    roots = [];
    input.remove();
    jest.restoreAllMocks();
    Object.defineProperty(window, 'visualViewport', {
      value: undefined,
      configurable: true,
    });
  });

  function mountProbe(): void {
    const Probe = () => {
      useVisualViewport();
      return null;
    };
    let root!: ReactTestRenderer;
    act(() => {
      root = create(<Probe />);
    });
    roots.push(root);
  }

  function setInputBottom(bottom: number): void {
    // This jsdom build has no DOMRect global; only `bottom` is read by
    // the reset, so a literal with the rect shape is enough.
    jest.spyOn(input, 'getBoundingClientRect').mockReturnValue({
      bottom,
      top: bottom - 40,
      left: 0,
      right: 300,
      x: 0,
      y: bottom - 40,
      width: 300,
      height: 40,
      toJSON: () => ({}),
    });
  }

  it('resets the pan only when the keyboard is open and the focused input is fully visible', () => {
    mountProbe();
    setInputBottom(400);
    input.focus();
    act(() => {
      fake.resizeTo(500, 50);
    });
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('does not reset when the focused input is not fully visible', () => {
    mountProbe();
    setInputBottom(600);
    input.focus();
    act(() => {
      fake.resizeTo(500, 50);
    });
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not reset when nothing is focused', () => {
    mountProbe();
    setInputBottom(400);
    act(() => {
      fake.resizeTo(500, 50);
    });
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not reset when the focused element is not a text input', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    mountProbe();
    setInputBottom(400);
    button.focus();
    act(() => {
      fake.resizeTo(500, 50);
    });
    expect(window.scrollTo).not.toHaveBeenCalled();
    button.remove();
  });

  it('does not reset when the viewport is not panned', () => {
    mountProbe();
    setInputBottom(400);
    input.focus();
    act(() => {
      fake.resizeTo(500, 0);
    });
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not reset when the keyboard is closed', () => {
    mountProbe();
    setInputBottom(400);
    input.focus();
    act(() => {
      fake.resizeTo(800, 50);
    });
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not reset twice after the reset lands', () => {
    mountProbe();
    setInputBottom(400);
    input.focus();
    act(() => {
      fake.resizeTo(500, 50);
    });
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    // The browser applies the reset: the pan is gone, so there is
    // nothing left to reset.
    act(() => {
      fake.scrollTo(0);
    });
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });
});
