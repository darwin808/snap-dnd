/**
 * Centralized drag state management
 * Single source of truth for the current drag session
 */
import type {
  DragSession,
  DragPhase,
  Point,
  StateEvent,
  Unsubscribe,
} from '../types/index.js';
import { EventEmitter } from '../utils/EventEmitter.js';
import { SnapDataTransfer } from '../utils/DataTransfer.js';

// Internal events
interface StateEvents {
  dragstart: DragSession;
  dragmove: DragSession;
  dragend: DragSession;
  dropzoneenter: DragSession;
  dropzoneleave: DragSession;
  drop: DragSession;
}

export class DragState extends EventEmitter<StateEvents> {
  private _session: DragSession | null = null;
  private _idCounter = 0;

  /**
   * Get current drag session (null if not dragging)
   */
  get session(): DragSession | null {
    return this._session;
  }

  /**
   * Check if currently dragging
   */
  isDragging(): boolean {
    return this._session !== null && this._session.phase === 'dragging';
  }

  /**
   * Get the element being dragged
   */
  getActiveElement(): HTMLElement | null {
    return this._session?.element ?? null;
  }

  /**
   * Get current drop zone
   */
  getCurrentDropZone(): HTMLElement | null {
    return this._session?.dropZone ?? null;
  }

  /**
   * Start a new drag session
   */
  startDrag(
    element: HTMLElement,
    origin: Point,
    initialData?: Record<string, unknown>
  ): DragSession {
    // End any existing session
    if (this._session) {
      this.cancelDrag();
    }

    const data = new SnapDataTransfer();
    if (initialData) {
      for (const [key, value] of Object.entries(initialData)) {
        data.setData(key, value);
      }
    }

    this._session = {
      id: `drag-${++this._idCounter}`,
      element,
      origin: { x: origin.x, y: origin.y },
      current: { x: origin.x, y: origin.y },
      delta: { x: 0, y: 0 },
      data,
      dropZone: null,
      phase: 'dragging',
    };

    this.emit('dragstart', this._session);
    return this._session;
  }

  /**
   * Update position during drag
   */
  updatePosition(point: Point): void {
    if (!this._session || this._session.phase !== 'dragging') return;

    this._session.current.x = point.x;
    this._session.current.y = point.y;
    this._session.delta.x = point.x - this._session.origin.x;
    this._session.delta.y = point.y - this._session.origin.y;

    this.emit('dragmove', this._session);
  }

  /**
   * Set or clear drop zone target
   */
  setDropTarget(zone: HTMLElement | null): void {
    if (!this._session) return;

    const previous = this._session.dropZone;
    if (previous === zone) return;

    // Emit leave for previous zone
    if (previous) {
      this._session.dropZone = null;
      this.emit('dropzoneleave', this._session);
    }

    // Emit enter for new zone
    if (zone) {
      this._session.dropZone = zone;
      this.emit('dropzoneenter', this._session);
    }
  }

  /**
   * Complete the drag with a drop
   */
  endDrag(): DragSession | null {
    if (!this._session) return null;

    const session = this._session;
    session.phase = 'dropping';

    // Emit drop if over a valid drop zone
    if (session.dropZone) {
      this.emit('drop', session);
    }

    this.emit('dragend', session);
    this._session = null;

    return session;
  }

  /**
   * Cancel the current drag
   */
  cancelDrag(): DragSession | null {
    if (!this._session) return null;

    const session = this._session;
    session.phase = 'cancelled';
    session.dropZone = null;

    this.emit('dragend', session);
    this._session = null;

    return session;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(event: StateEvent, callback: (session: DragSession) => void): Unsubscribe {
    return this.on(event, callback);
  }

  /**
   * Reset state
   */
  reset(): void {
    if (this._session) {
      this.cancelDrag();
    }
  }

  /**
   * Cleanup
   */
  override destroy(): void {
    this.reset();
    super.destroy();
  }
}
