/**
 * DragEngine orchestrates the drag operation
 * Coordinates between sensors, state, and drop zones
 */
import type { Point, SnapOptions, Axis } from '../types/index.js';
import { DragState } from './DragState.js';
import {
  PointerSensor,
  type PointerStartEvent,
  type PointerMoveEvent,
  type PointerEndEvent,
} from '../sensors/PointerSensor.js';
import { boundsCache, pointInRect } from '../utils/BoundsCache.js';
import { pointPool } from '../utils/ObjectPool.js';

export interface DragEngineOptions {
  container: HTMLElement | ShadowRoot;
  state: DragState;
  options: SnapOptions;
  getDropZones: () => HTMLElement[];
  getItemData: (element: HTMLElement) => Record<string, unknown> | undefined;
  getItemAxis: (element: HTMLElement) => Axis | undefined;
}

export class DragEngine {
  private _container: HTMLElement | ShadowRoot;
  private _state: DragState;
  private _options: SnapOptions;
  private _getDropZones: () => HTMLElement[];
  private _getItemData: (element: HTMLElement) => Record<string, unknown> | undefined;
  private _getItemAxis: (element: HTMLElement) => Axis | undefined;

  private _pointerSensor: PointerSensor;
  private _enabled = false;
  private _listenerUnsubscribers: (() => void)[] = [];

  // Ghost element for visual feedback
  private _ghost: HTMLElement | null = null;
  private _ghostOffset: Point = { x: 0, y: 0 };

  constructor(engineOptions: DragEngineOptions) {
    this._container = engineOptions.container;
    this._state = engineOptions.state;
    this._options = engineOptions.options;
    this._getDropZones = engineOptions.getDropZones;
    this._getItemData = engineOptions.getItemData;
    this._getItemAxis = engineOptions.getItemAxis;

    // Initialize pointer sensor
    this._pointerSensor = new PointerSensor({
      container: this._container,
      draggableSelector: this._options.draggableSelector ?? '[data-draggable]',
      handleSelector: this._options.handleSelector,
      delay: this._options.delay,
      distance: this._options.distance,
    });

    this._setupListeners();
  }

  /**
   * Enable drag engine
   */
  enable(): void {
    if (this._enabled) return;
    this._pointerSensor.attach();
    this._enabled = true;
  }

  /**
   * Disable drag engine
   */
  disable(): void {
    if (!this._enabled) return;
    this._pointerSensor.detach();
    this._state.reset();
    this._removeGhost();
    this._enabled = false;
  }

  /**
   * Check if enabled
   */
  get isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<SnapOptions>): void {
    Object.assign(this._options, options);
  }

  private _setupListeners(): void {
    this._listenerUnsubscribers.push(
      this._pointerSensor.on('pointerdown', this._onPointerDown),
      this._pointerSensor.on('pointermove', this._onPointerMove),
      this._pointerSensor.on('pointerup', this._onPointerUp),
      this._pointerSensor.on('pointercancel', this._onPointerCancel)
    );
  }

  private _onPointerDown = (event: PointerStartEvent): void => {
    const { element, position } = event;

    // Get item data from data attributes or imperative registration
    const data = this._getItemData(element) ?? this._extractDataAttributes(element);

    // Start drag session
    const session = this._state.startDrag(element, position, data);

    // Call user callback
    const startEvent = {
      element,
      position: { x: position.x, y: position.y },
      data: session.data,
      cancel: () => {
        this._state.cancelDrag();
      },
    };

    const result = this._options.onDragStart?.(startEvent);
    if (result === false) {
      this._state.cancelDrag();
      return;
    }

    // Create ghost element
    this._createGhost(element, position);

    // Add dragging class
    element.classList.add('snap-dragging');
    if (this._options.ghostClass) {
      element.classList.add(this._options.ghostClass);
    }

    // Invalidate bounds cache (positions may change)
    boundsCache.invalidateAll();
  };

  private _onPointerMove = (event: PointerMoveEvent): void => {
    const session = this._state.session;
    if (!session) return;

    let { position } = event;

    // Apply axis constraints
    const axis = this._getItemAxis(session.element) ?? this._options.axis ?? 'both';
    if (axis !== 'both') {
      position = this._applyAxisConstraint(position, session.origin, axis);
    }

    // Apply grid snapping
    if (this._options.grid) {
      position = this._applyGridSnap(position, this._options.grid);
    }

    // Update state
    this._state.updatePosition(position);

    // Update ghost position
    this._updateGhost(position);

    // Hit test drop zones
    this._updateDropZone(position);

    // Call user callback
    this._options.onDragMove?.({
      element: session.element,
      position: { x: session.current.x, y: session.current.y },
      delta: { x: session.delta.x, y: session.delta.y },
      dropZone: session.dropZone,
    });
  };

  private _onPointerUp = (event: PointerEndEvent): void => {
    const session = this._state.session;
    if (!session) return;

    // End drag and get final session
    const finalSession = this._state.endDrag();
    if (!finalSession) return;

    // Remove visual feedback
    this._cleanup(finalSession.element);

    // Call drop callback if over valid zone
    if (finalSession.dropZone) {
      this._options.onDrop?.({
        element: finalSession.element,
        dropZone: finalSession.dropZone,
        position: { x: finalSession.current.x, y: finalSession.current.y },
        data: finalSession.data,
      });
    }

    // Call end callback
    this._options.onDragEnd?.({
      element: finalSession.element,
      position: { x: finalSession.current.x, y: finalSession.current.y },
      delta: { x: finalSession.delta.x, y: finalSession.delta.y },
      cancelled: false,
    });
  };

  private _onPointerCancel = (event: PointerEndEvent): void => {
    const session = this._state.session;
    if (!session) return;

    const element = session.element;
    this._state.cancelDrag();
    this._cleanup(element);

    this._options.onDragEnd?.({
      element,
      position: event.position,
      delta: { x: 0, y: 0 },
      cancelled: true,
    });
  };

  private _applyAxisConstraint(position: Point, origin: Point, axis: Axis): Point {
    if (axis === 'x') {
      return { x: position.x, y: origin.y };
    }
    if (axis === 'y') {
      return { x: origin.x, y: position.y };
    }
    return position;
  }

  private _applyGridSnap(position: Point, grid: { x: number; y: number }): Point {
    return {
      x: Math.round(position.x / grid.x) * grid.x,
      y: Math.round(position.y / grid.y) * grid.y,
    };
  }

  private _updateDropZone(position: Point): void {
    const dropZones = this._getDropZones();
    let foundZone: HTMLElement | null = null;

    for (const zone of dropZones) {
      const rect = boundsCache.get(zone);
      if (pointInRect(position.x, position.y, rect)) {
        foundZone = zone;
        break;
      }
    }

    const session = this._state.session;
    if (!session) return;

    // Handle zone change
    if (foundZone !== session.dropZone) {
      if (session.dropZone) {
        this._options.onDropZoneLeave?.({
          element: session.element,
          dropZone: session.dropZone,
        });
      }

      this._state.setDropTarget(foundZone);

      if (foundZone) {
        this._options.onDropZoneEnter?.({
          element: session.element,
          dropZone: foundZone,
          position,
        });
      }
    }
  }

  private _createGhost(element: HTMLElement, position: Point): void {
    const rect = element.getBoundingClientRect();

    // Calculate offset from cursor to element origin
    this._ghostOffset = {
      x: position.x - rect.left,
      y: position.y - rect.top,
    };

    // Clone element for ghost
    this._ghost = element.cloneNode(true) as HTMLElement;
    this._ghost.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      margin: 0;
      pointer-events: none;
      z-index: 9999;
      opacity: 0.8;
      will-change: transform;
    `;
    this._ghost.classList.add('snap-ghost');

    // Append to body (not container, to avoid transform issues)
    document.body.appendChild(this._ghost);
  }

  private _updateGhost(position: Point): void {
    if (!this._ghost) return;

    const x = position.x - this._ghostOffset.x;
    const y = position.y - this._ghostOffset.y;

    // Use transform for better performance
    this._ghost.style.transform = `translate(${x - parseFloat(this._ghost.style.left)}px, ${y - parseFloat(this._ghost.style.top)}px)`;
  }

  private _removeGhost(): void {
    if (this._ghost) {
      this._ghost.remove();
      this._ghost = null;
    }
  }

  private _cleanup(element: HTMLElement): void {
    element.classList.remove('snap-dragging');
    if (this._options.ghostClass) {
      element.classList.remove(this._options.ghostClass);
    }
    this._removeGhost();
  }

  private _extractDataAttributes(element: HTMLElement): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    // Extract data-drag-* attributes
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-drag-')) {
        const key = attr.name.slice(10); // Remove 'data-drag-'
        data[key] = attr.value;
      }
    }

    // Also include data-draggable value if present
    const draggableValue = element.dataset.draggable;
    if (draggableValue && draggableValue !== '') {
      data.type = draggableValue;
    }

    return data;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.disable();

    // Unsubscribe from pointer sensor events
    for (const unsub of this._listenerUnsubscribers) {
      unsub();
    }
    this._listenerUnsubscribers = [];

    this._pointerSensor.destroy();
  }
}
