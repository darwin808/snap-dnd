/**
 * SnapGrid behavior - snaps drag position to a grid
 * Note: This is handled in DragEngine via options.grid
 * This behavior provides additional grid-related features
 */
import type { Behavior, DragSession, GridOptions } from '../types/index.js';

export interface SnapGridOptions extends GridOptions {
  /** Only snap when within threshold of grid line */
  threshold?: number;
  /** Show visual grid guides */
  showGuides?: boolean;
}

export class SnapGrid implements Behavior {
  name = 'snap-grid';

  private _options: SnapGridOptions;
  private _guideContainer: HTMLElement | null = null;

  constructor(options: SnapGridOptions) {
    this._options = options;
  }

  onDragStart(session: DragSession): void {
    if (this._options.showGuides) {
      this._createGuides(session.element);
    }
  }

  onDragMove(_session: DragSession): void {
    // Grid snapping is handled by DragEngine
    // This behavior could add additional visual feedback
  }

  onDragEnd(): void {
    this._removeGuides();
  }

  destroy(): void {
    this._removeGuides();
  }

  /**
   * Snap a point to the grid
   */
  snap(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.round(x / this._options.x) * this._options.x,
      y: Math.round(y / this._options.y) * this._options.y,
    };
  }

  /**
   * Snap with threshold - only snap when close to grid line
   */
  snapWithThreshold(
    x: number,
    y: number,
    threshold?: number
  ): { x: number; y: number } {
    const t = threshold ?? this._options.threshold ?? 5;
    const snapped = this.snap(x, y);

    return {
      x: Math.abs(x - snapped.x) < t ? snapped.x : x,
      y: Math.abs(y - snapped.y) < t ? snapped.y : y,
    };
  }

  private _createGuides(element: HTMLElement): void {
    const container = element.offsetParent || document.body;
    const rect = container.getBoundingClientRect();

    this._guideContainer = document.createElement('div');
    this._guideContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 9998;
    `;

    // Create vertical lines
    const cols = Math.ceil(rect.width / this._options.x);
    for (let i = 1; i < cols; i++) {
      const line = document.createElement('div');
      line.style.cssText = `
        position: absolute;
        left: ${i * this._options.x}px;
        top: 0;
        bottom: 0;
        width: 1px;
        background: rgba(0, 120, 255, 0.2);
      `;
      this._guideContainer.appendChild(line);
    }

    // Create horizontal lines
    const rows = Math.ceil(rect.height / this._options.y);
    for (let i = 1; i < rows; i++) {
      const line = document.createElement('div');
      line.style.cssText = `
        position: absolute;
        top: ${i * this._options.y}px;
        left: 0;
        right: 0;
        height: 1px;
        background: rgba(0, 120, 255, 0.2);
      `;
      this._guideContainer.appendChild(line);
    }

    container.appendChild(this._guideContainer);
  }

  private _removeGuides(): void {
    this._guideContainer?.remove();
    this._guideContainer = null;
  }
}
