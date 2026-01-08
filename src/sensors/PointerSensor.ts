/**
 * Unified pointer event sensor
 * Handles mouse, touch, and pointer events through event delegation
 */
import type { Point, Sensor } from '../types/index.js';
import { EventEmitter } from '../utils/EventEmitter.js';
import { RAFThrottle } from '../utils/RAFThrottle.js';
import { acquirePoint, pointPool } from '../utils/ObjectPool.js';

export interface PointerSensorEvents {
  pointerdown: PointerStartEvent;
  pointermove: PointerMoveEvent;
  pointerup: PointerEndEvent;
  pointercancel: PointerEndEvent;
}

export interface PointerStartEvent {
  element: HTMLElement;
  position: Point;
  pointerId: number;
  originalEvent: PointerEvent;
}

export interface PointerMoveEvent {
  position: Point;
  delta: Point;
  pointerId: number;
  originalEvent: PointerEvent;
}

export interface PointerEndEvent {
  position: Point;
  pointerId: number;
  originalEvent: PointerEvent;
}

export interface PointerSensorOptions {
  container: HTMLElement | ShadowRoot;
  draggableSelector: string;
  handleSelector?: string;
  delay?: number;
  distance?: number;
}

export class PointerSensor
  extends EventEmitter<PointerSensorEvents>
  implements Sensor
{
  private _container: HTMLElement | ShadowRoot;
  private _options: PointerSensorOptions;
  private _attached = false;

  // Active drag state
  private _activePointerId: number | null = null;
  private _activeElement: HTMLElement | null = null;
  private _startPosition: Point | null = null;
  private _isDragging = false;
  private _delayTimer: number | null = null;

  // RAF throttle for move events
  private _moveThrottle: RAFThrottle<PointerEvent>;

  constructor(options: PointerSensorOptions) {
    super();
    this._container = options.container;
    this._options = options;

    this._moveThrottle = new RAFThrottle((e) => this._processMove(e));
  }

  /**
   * Attach event listeners
   */
  attach(): void {
    if (this._attached) return;

    const target = this._getEventTarget();
    target.addEventListener('pointerdown', this._onPointerDown, {
      passive: false,
    });

    this._attached = true;
  }

  /**
   * Detach event listeners
   */
  detach(): void {
    if (!this._attached) return;

    const target = this._getEventTarget();
    target.removeEventListener('pointerdown', this._onPointerDown);

    this._cleanup();
    this._attached = false;
  }

  /**
   * Check if currently tracking a drag
   */
  get isActive(): boolean {
    return this._activePointerId !== null;
  }

  /**
   * Check if drag has started (past delay/distance threshold)
   */
  get isDragging(): boolean {
    return this._isDragging;
  }

  private _getEventTarget(): HTMLElement | Document {
    // For ShadowRoot, attach to the host element
    if (this._container instanceof ShadowRoot) {
      return this._container.host as HTMLElement;
    }
    return this._container;
  }

  private _onPointerDown = (e: PointerEvent): void => {
    // Only handle primary pointer (left mouse button, first touch)
    if (!e.isPrimary || e.button !== 0) return;

    // Already tracking a pointer
    if (this._activePointerId !== null) return;

    // Find draggable element using event delegation
    const draggable = this._findDraggable(e);
    if (!draggable) return;

    // Check if click was on handle (if handle selector is specified)
    if (this._options.handleSelector) {
      const handle = this._findHandle(e, draggable);
      if (!handle) return;
    }

    // Prevent default to avoid text selection and native drag
    e.preventDefault();

    // Store initial state
    this._activePointerId = e.pointerId;
    this._activeElement = draggable;
    this._startPosition = acquirePoint(e.clientX, e.clientY);
    this._isDragging = false;

    // Set pointer capture for reliable tracking
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Attach move/up listeners
    const target = this._getEventTarget();
    target.addEventListener('pointermove', this._onPointerMove, {
      passive: true,
    });
    target.addEventListener('pointerup', this._onPointerUp);
    target.addEventListener('pointercancel', this._onPointerCancel);

    // Handle delay threshold
    const delay = this._options.delay ?? 0;
    if (delay > 0) {
      this._delayTimer = window.setTimeout(() => {
        this._delayTimer = null;
        this._startDrag(e);
      }, delay);
    } else if ((this._options.distance ?? 0) === 0) {
      // No delay or distance, start immediately
      this._startDrag(e);
    }
  };

  private _onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this._activePointerId) return;

    // Queue for RAF processing
    this._moveThrottle.queue(e);
  };

  private _processMove = (e: PointerEvent): void => {
    if (!this._startPosition || !this._activeElement) return;

    const position = acquirePoint(e.clientX, e.clientY);

    // Check distance threshold if not yet dragging
    if (!this._isDragging) {
      const distance = this._options.distance ?? 0;
      if (distance > 0) {
        const dx = position.x - this._startPosition.x;
        const dy = position.y - this._startPosition.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < distance) {
          pointPool.release(position);
          return;
        }

        // Distance threshold reached, start drag
        this._clearDelayTimer();
        this._startDrag(e);
      }
    }

    if (this._isDragging) {
      const delta = acquirePoint(
        position.x - this._startPosition.x,
        position.y - this._startPosition.y
      );

      this.emit('pointermove', {
        position,
        delta,
        pointerId: e.pointerId,
        originalEvent: e,
      });

      // Note: caller is responsible for releasing position/delta
    } else {
      pointPool.release(position);
    }
  };

  private _onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this._activePointerId) return;

    this._moveThrottle.flush();

    if (this._isDragging) {
      this.emit('pointerup', {
        position: acquirePoint(e.clientX, e.clientY),
        pointerId: e.pointerId,
        originalEvent: e,
      });
    }

    this._cleanup();
  };

  private _onPointerCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this._activePointerId) return;

    this._moveThrottle.cancel();

    if (this._isDragging) {
      this.emit('pointercancel', {
        position: acquirePoint(e.clientX, e.clientY),
        pointerId: e.pointerId,
        originalEvent: e,
      });
    }

    this._cleanup();
  };

  private _startDrag(e: PointerEvent): void {
    if (this._isDragging || !this._activeElement || !this._startPosition) return;

    this._isDragging = true;

    this.emit('pointerdown', {
      element: this._activeElement,
      position: { x: this._startPosition.x, y: this._startPosition.y },
      pointerId: e.pointerId,
      originalEvent: e,
    });
  }

  private _findDraggable(e: PointerEvent): HTMLElement | null {
    const target = e.target as Element;

    // Handle shadow DOM by using composedPath
    const path = e.composedPath();

    for (const el of path) {
      if (!(el instanceof HTMLElement)) continue;

      if (el.matches(this._options.draggableSelector)) {
        return el;
      }

      // Stop at container boundary
      if (el === this._container || el === (this._container as ShadowRoot).host) {
        break;
      }
    }

    // Fallback for non-composed path
    return target.closest?.(this._options.draggableSelector) as HTMLElement | null;
  }

  private _findHandle(e: PointerEvent, draggable: HTMLElement): HTMLElement | null {
    if (!this._options.handleSelector) return draggable;

    const target = e.target as Element;
    const handle = target.closest?.(this._options.handleSelector) as HTMLElement | null;

    // Handle must be inside the draggable
    if (handle && draggable.contains(handle)) {
      return handle;
    }

    return null;
  }

  private _clearDelayTimer(): void {
    if (this._delayTimer !== null) {
      clearTimeout(this._delayTimer);
      this._delayTimer = null;
    }
  }

  private _cleanup(): void {
    this._clearDelayTimer();
    this._moveThrottle.cancel();

    // Release pooled objects
    if (this._startPosition) {
      pointPool.release(this._startPosition);
      this._startPosition = null;
    }

    // Remove move/up listeners
    const target = this._getEventTarget();
    target.removeEventListener('pointermove', this._onPointerMove);
    target.removeEventListener('pointerup', this._onPointerUp);
    target.removeEventListener('pointercancel', this._onPointerCancel);

    this._activePointerId = null;
    this._activeElement = null;
    this._isDragging = false;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.detach();
    this._moveThrottle.destroy();
    super.destroy();
  }
}
