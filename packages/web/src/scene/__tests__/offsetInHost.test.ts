import { offsetInHost } from '@/scene/SeatDecoration';

function layout(element: HTMLElement, box: { left: number; top: number; parent: HTMLElement }) {
  Object.defineProperty(element, 'offsetLeft', { value: box.left });
  Object.defineProperty(element, 'offsetTop', { value: box.top });
  Object.defineProperty(element, 'offsetParent', { value: box.parent });
}

describe('offsetInHost', () => {
  it('subtracts the scroll of containers between the element and the host', () => {
    const host = document.createElement('div');
    const scroller = document.createElement('div');
    const cell = document.createElement('div');
    const tile = document.createElement('button');
    host.append(scroller);
    scroller.append(cell);
    cell.append(tile);
    layout(scroller, { left: 0, top: 40, parent: host });
    Object.defineProperty(scroller, 'scrollTop', { value: 120 });
    layout(cell, { left: 16, top: 300, parent: host });
    layout(tile, { left: 4, top: 4, parent: cell });

    expect(offsetInHost(tile, host)).toEqual({ x: 20, y: 184 });
  });

  it('measures a sibling host against their shared offset parent', () => {
    const grid = document.createElement('div');
    const host = document.createElement('div');
    const tile = document.createElement('button');
    grid.append(tile, host);
    layout(host, { left: 0, top: 10, parent: grid });
    layout(tile, { left: 30, top: 50, parent: grid });

    expect(offsetInHost(tile, host)).toEqual({ x: 30, y: 40 });
  });
});
