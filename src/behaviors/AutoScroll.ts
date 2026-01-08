/**
 * AutoScroll behavior - scrolls containers when dragging near edges
 */
import type { Behavior, DragSession, AutoScrollOptions } from '../types/index.js';

const defaultOptions: Required<AutoScrollOptions> = {
  threshold: 40,
  maxSpeed: 15,
  acceleration: 2,
};

export class AutoScroll implements Behavior {
  name = 'auto-scroll';

  private _options: Required<AutoScrollOptions>;
  private _scrollableAncestors: Element[] = [];
  private _rafId: number | null = null;
  private _active = false;

  constructor(options: AutoScrollOptions = {}) {
    this._options = { ...defaultOptions, ...options };
  }

  onDragStart(session: DragSession): void {
    this._scrollableAncestors = this._findScrollableAncestors(session.element);
    this._active = true;
  }

  onDragMove(session: DragSession): void {
    if (!this._active || this._rafId !== null) return;

    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._performScroll(session.current.x, session.current.y);
    });
  }

  onDragEnd(): void {
    this._active = false;
    this._scrollableAncestors = [];
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  destroy(): void {
    this.onDragEnd();
  }

  private _performScroll(x: number, y: number): void {
    for (const ancestor of this._scrollableAncestors) {
      const rect = ancestor.getBoundingClientRect();
      const speed = this._calculateScrollSpeed(x, y, rect);

      if (speed.x !== 0 || speed.y !== 0) {
        ancestor.scrollBy({
          left: speed.x,
          top: speed.y,
          behavior: 'instant',
        });
      }
    }
  }

  private _calculateScrollSpeed(
    x: number,
    y: number,
    rect: DOMRect
  ): { x: number; y: number } {
    const { threshold, maxSpeed } = this._options;
    let scrollX = 0;
    let scrollY = 0;

    // Left edge
    if (x < rect.left + threshold) {
      scrollX = -this._getSpeed(rect.left + threshold - x);
    }
    // Right edge
    else if (x > rect.right - threshold) {
      scrollX = this._getSpeed(x - (rect.right - threshold));
    }

    // Top edge
    if (y < rect.top + threshold) {
      scrollY = -this._getSpeed(rect.top + threshold - y);
    }
    // Bottom edge
    else if (y > rect.bottom - threshold) {
      scrollY = this._getSpeed(y - (rect.bottom - threshold));
    }

    return { x: scrollX, y: scrollY };
  }

  private _getSpeed(distance: number): number {
    const { threshold, maxSpeed, acceleration } = this._options;
    const ratio = Math.min(distance / threshold, 1);
    return Math.pow(ratio, acceleration) * maxSpeed;
  }

  private _findScrollableAncestors(element: HTMLElement): Element[] {
    const ancestors: Element[] = [];
    let current: Element | null = element.parentElement;

    while (current && current !== document.body) {
      const style = getComputedStyle(current);
      const overflowX = style.overflowX;
      const overflowY = style.overflowY;

      const isScrollableX =
        (overflowX === 'auto' || overflowX === 'scroll') &&
        current.scrollWidth > current.clientWidth;

      const isScrollableY =
        (overflowY === 'auto' || overflowY === 'scroll') &&
        current.scrollHeight > current.clientHeight;

      if (isScrollableX || isScrollableY) {
        ancestors.push(current);
      }

      current = current.parentElement;
    }

    // Also include document scroll
    if (
      document.documentElement.scrollHeight > window.innerHeight ||
      document.documentElement.scrollWidth > window.innerWidth
    ) {
      ancestors.push(document.documentElement);
    }

    return ancestors;
  }
}
