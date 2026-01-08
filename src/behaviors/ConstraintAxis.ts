/**
 * ConstraintAxis behavior - constrain movement to specific axis
 * Note: Basic axis constraint is handled in DragEngine via options.axis
 * This behavior adds additional constraint features like bounds
 */
import type { Behavior, DragSession, Axis, Point } from '../types/index.js';

export interface ConstraintOptions {
  axis?: Axis;
  /** Bounding rectangle to constrain within */
  bounds?: {
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
  };
  /** Constrain to parent element bounds */
  containWithinParent?: boolean;
}

export class ConstraintAxis implements Behavior {
  name = 'constraint-axis';

  private _options: ConstraintOptions;
  private _bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null = null;

  constructor(options: ConstraintOptions = {}) {
    this._options = options;
  }

  onDragStart(session: DragSession): void {
    if (this._options.containWithinParent) {
      this._calculateParentBounds(session.element);
    } else if (this._options.bounds) {
      this._bounds = {
        minX: this._options.bounds.minX ?? -Infinity,
        maxX: this._options.bounds.maxX ?? Infinity,
        minY: this._options.bounds.minY ?? -Infinity,
        maxY: this._options.bounds.maxY ?? Infinity,
      };
    }
  }

  onDragMove(_session: DragSession): void {
    // Constraint is applied in DragEngine
    // This behavior provides bounds calculation
  }

  onDragEnd(): void {
    this._bounds = null;
  }

  destroy(): void {
    this._bounds = null;
  }

  /**
   * Apply constraints to a point
   */
  constrain(point: Point, origin: Point): Point {
    let { x, y } = point;

    // Apply axis constraint
    const axis = this._options.axis ?? 'both';
    if (axis === 'x') {
      y = origin.y;
    } else if (axis === 'y') {
      x = origin.x;
    }

    // Apply bounds constraint
    if (this._bounds) {
      x = Math.max(this._bounds.minX, Math.min(this._bounds.maxX, x));
      y = Math.max(this._bounds.minY, Math.min(this._bounds.maxY, y));
    }

    return { x, y };
  }

  /**
   * Get current bounds
   */
  getBounds(): typeof this._bounds {
    return this._bounds;
  }

  private _calculateParentBounds(element: HTMLElement): void {
    const parent = element.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    // Calculate bounds that keep element within parent
    this._bounds = {
      minX: parentRect.left,
      maxX: parentRect.right - elementRect.width,
      minY: parentRect.top,
      maxY: parentRect.bottom - elementRect.height,
    };
  }
}
