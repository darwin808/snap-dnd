/**
 * File drop sensor for handling external file drags
 * Uses native HTML5 drag and drop API since pointer events
 * don't work for external drags
 */
import type { Point, Sensor } from '../types/index.js';
import { EventEmitter } from '../utils/EventEmitter.js';

export interface FileSensorEvents {
  dragenter: FileDragEvent;
  dragover: FileDragEvent;
  dragleave: FileDragEvent;
  drop: FileDropEvent;
}

export interface FileDragEvent {
  position: Point;
  dropZone: HTMLElement;
  originalEvent: DragEvent;
}

export interface FileDropEvent {
  files: File[];
  position: Point;
  dropZone: HTMLElement;
  originalEvent: DragEvent;
}

export interface FileSensorOptions {
  container: HTMLElement | ShadowRoot;
  dropZoneSelector: string;
  accept?: string[];
  multiple?: boolean;
  maxSize?: number;
}

export class FileSensor
  extends EventEmitter<FileSensorEvents>
  implements Sensor
{
  private _container: HTMLElement | ShadowRoot;
  private _options: FileSensorOptions;
  private _attached = false;
  private _dragCount = 0;
  private _currentDropZone: HTMLElement | null = null;

  constructor(options: FileSensorOptions) {
    super();
    this._container = options.container;
    this._options = options;
  }

  attach(): void {
    if (this._attached) return;

    const target = this._getEventTarget();
    target.addEventListener('dragenter', this._onDragEnter, { passive: false });
    target.addEventListener('dragover', this._onDragOver, { passive: false });
    target.addEventListener('dragleave', this._onDragLeave, { passive: false });
    target.addEventListener('drop', this._onDrop, { passive: false });

    this._attached = true;
  }

  detach(): void {
    if (!this._attached) return;

    const target = this._getEventTarget();
    target.removeEventListener('dragenter', this._onDragEnter);
    target.removeEventListener('dragover', this._onDragOver);
    target.removeEventListener('dragleave', this._onDragLeave);
    target.removeEventListener('drop', this._onDrop);

    this._dragCount = 0;
    this._currentDropZone = null;
    this._attached = false;
  }

  private _getEventTarget(): HTMLElement | Document {
    if (this._container instanceof ShadowRoot) {
      return this._container.host as HTMLElement;
    }
    return this._container;
  }

  private _onDragEnter = (e: DragEvent): void => {
    // Only handle file drags
    if (!this._hasFiles(e)) return;

    this._dragCount++;

    const dropZone = this._findDropZone(e);
    if (!dropZone) return;

    e.preventDefault();

    if (dropZone !== this._currentDropZone) {
      if (this._currentDropZone) {
        this.emit('dragleave', {
          position: { x: e.clientX, y: e.clientY },
          dropZone: this._currentDropZone,
          originalEvent: e,
        });
      }

      this._currentDropZone = dropZone;
      this.emit('dragenter', {
        position: { x: e.clientX, y: e.clientY },
        dropZone,
        originalEvent: e,
      });
    }
  };

  private _onDragOver = (e: DragEvent): void => {
    if (!this._hasFiles(e)) return;

    const dropZone = this._findDropZone(e);
    if (!dropZone) return;

    // Must prevent default to allow drop
    e.preventDefault();

    // Set drop effect
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }

    this.emit('dragover', {
      position: { x: e.clientX, y: e.clientY },
      dropZone,
      originalEvent: e,
    });
  };

  private _onDragLeave = (e: DragEvent): void => {
    if (!this._hasFiles(e)) return;

    this._dragCount--;

    // Only emit leave when truly leaving the container
    if (this._dragCount === 0 && this._currentDropZone) {
      this.emit('dragleave', {
        position: { x: e.clientX, y: e.clientY },
        dropZone: this._currentDropZone,
        originalEvent: e,
      });
      this._currentDropZone = null;
    }
  };

  private _onDrop = (e: DragEvent): void => {
    e.preventDefault();
    this._dragCount = 0;

    const dropZone = this._findDropZone(e);
    if (!dropZone) return;

    const files = this._getFiles(e);
    if (files.length === 0) return;

    this.emit('drop', {
      files,
      position: { x: e.clientX, y: e.clientY },
      dropZone,
      originalEvent: e,
    });

    this._currentDropZone = null;
  };

  private _findDropZone(e: DragEvent): HTMLElement | null {
    const target = e.target as Element;

    // Use composedPath for shadow DOM
    const path = e.composedPath();
    for (const el of path) {
      if (!(el instanceof HTMLElement)) continue;

      if (el.matches(this._options.dropZoneSelector)) {
        return el;
      }

      if (el === this._container || el === (this._container as ShadowRoot).host) {
        break;
      }
    }

    return target.closest?.(this._options.dropZoneSelector) as HTMLElement | null;
  }

  private _hasFiles(e: DragEvent): boolean {
    if (!e.dataTransfer) return false;

    // Check for files in types
    const types = e.dataTransfer.types;
    return types.includes('Files') || types.includes('application/x-moz-file');
  }

  private _getFiles(e: DragEvent): File[] {
    if (!e.dataTransfer?.files) return [];

    let files = Array.from(e.dataTransfer.files);

    // Filter by accept
    const accept = this._options.accept;
    if (accept && accept.length > 0) {
      files = files.filter((file) => this._matchesAccept(file, accept));
    }

    // Filter by max size
    const maxSize = this._options.maxSize;
    if (maxSize && maxSize > 0) {
      files = files.filter((file) => file.size <= maxSize);
    }

    // Limit to single file if not multiple
    if (!this._options.multiple && files.length > 1) {
      files = [files[0]];
    }

    return files;
  }

  private _matchesAccept(file: File, accept: string[]): boolean {
    for (const pattern of accept) {
      // Extension match (e.g., ".pdf")
      if (pattern.startsWith('.')) {
        if (file.name.toLowerCase().endsWith(pattern.toLowerCase())) {
          return true;
        }
        continue;
      }

      // MIME type match (e.g., "image/*" or "application/pdf")
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -1);
        if (file.type.startsWith(prefix)) {
          return true;
        }
        continue;
      }

      // Exact MIME match
      if (file.type === pattern) {
        return true;
      }
    }

    return false;
  }

  destroy(): void {
    this.detach();
    super.destroy();
  }
}
