/**
 * Snap Core - Minimal drag and drop (~4KB gzipped)
 * Import plugins separately if needed
 */

// Core only - no plugins, no behaviors
export { Snap, default } from './core/Snap.js';
export { DragState } from './core/DragState.js';
export { DropZone, DropZoneManager } from './core/DropZone.js';

// Types
export type {
  Point,
  Rect,
  Axis,
  Unsubscribe,
  DragSession,
  DragPhase,
  DataTransfer,
  DragStartEvent,
  DragMoveEvent,
  DragEndEvent,
  DropEvent,
  DropZoneEnterEvent,
  DropZoneLeaveEvent,
  SnapOptions,
  SnapInstance,
  ItemOptions,
  DropZoneOptions,
} from './types/index.js';
