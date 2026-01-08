/**
 * FileDrop plugin - enables file drop zones for external files
 */
import type {
  Plugin,
  SnapInstance,
  FileDropOptions,
  FileDropEvent,
} from '../types/index.js';
import {
  FileSensor,
  type FileDropEvent as SensorDropEvent,
} from '../sensors/FileSensor.js';

const defaultOptions: FileDropOptions = {
  multiple: true,
};

export class FileDrop implements Plugin {
  name = 'file-drop';

  private _snap: SnapInstance | null = null;
  private _options: FileDropOptions;
  private _sensor: FileSensor | null = null;
  private _onFileDrop: ((event: FileDropEvent) => void) | null = null;

  constructor(options: FileDropOptions = {}) {
    this._options = { ...defaultOptions, ...options };
  }

  init(snap: SnapInstance): void {
    this._snap = snap;

    // Get container element
    const container = this._getContainer();
    if (!container) return;

    // Initialize file sensor
    this._sensor = new FileSensor({
      container,
      dropZoneSelector: snap.options.dropZoneSelector ?? '[data-file-drop]',
      accept: this._options.accept,
      multiple: this._options.multiple,
      maxSize: this._options.maxSize,
    });

    // Setup event handlers
    this._setupEventHandlers();

    // Attach sensor
    this._sensor.attach();
  }

  destroy(): void {
    this._sensor?.destroy();
    this._sensor = null;
    this._snap = null;
    this._onFileDrop = null;
  }

  /**
   * Set callback for file drop events
   */
  onFileDrop(callback: (event: FileDropEvent) => void): this {
    this._onFileDrop = callback;
    return this;
  }

  /**
   * Update file drop options
   */
  setOptions(options: Partial<FileDropOptions>): void {
    Object.assign(this._options, options);
  }

  private _getContainer(): HTMLElement | ShadowRoot | null {
    if (!this._snap) return null;

    // Access internal container - this is a bit of a hack
    // In a real implementation, we'd expose this properly
    return (this._snap as unknown as { _container: HTMLElement | ShadowRoot })._container;
  }

  private _setupEventHandlers(): void {
    if (!this._sensor) return;

    // Handle drag enter
    this._sensor.on('dragenter', (e) => {
      e.dropZone.classList.add('snap-file-drag-over');
    });

    // Handle drag leave
    this._sensor.on('dragleave', (e) => {
      e.dropZone.classList.remove('snap-file-drag-over');
    });

    // Handle drop
    this._sensor.on('drop', (e: SensorDropEvent) => {
      e.dropZone.classList.remove('snap-file-drag-over');

      const event: FileDropEvent = {
        files: e.files,
        position: e.position,
        dropZone: e.dropZone,
      };

      // Call plugin callback
      this._onFileDrop?.(event);

      // Also emit through snap options if configured
      const snapOptions = this._snap?.options as unknown as {
        onFileDrop?: (event: FileDropEvent) => void;
      };
      snapOptions?.onFileDrop?.(event);
    });
  }
}

/**
 * Simple file drop zone creation helper
 * For basic use cases without full Snap instance
 */
export function createFileDropZone(
  element: HTMLElement,
  options: FileDropOptions & {
    onDrop: (files: File[]) => void;
    onDragEnter?: () => void;
    onDragLeave?: () => void;
  }
): () => void {
  const { onDrop, onDragEnter, onDragLeave, ...fileOptions } = options;

  let dragCount = 0;

  const handleDragEnter = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCount++;
    if (dragCount === 1) {
      element.classList.add('snap-file-drag-over');
      onDragEnter?.();
    }
  };

  const handleDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    dragCount--;
    if (dragCount === 0) {
      element.classList.remove('snap-file-drag-over');
      onDragLeave?.();
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragCount = 0;
    element.classList.remove('snap-file-drag-over');

    let files = Array.from(e.dataTransfer?.files ?? []);

    // Filter by accept
    if (fileOptions.accept?.length) {
      files = files.filter((file) => matchesAccept(file, fileOptions.accept!));
    }

    // Filter by max size
    if (fileOptions.maxSize) {
      files = files.filter((file) => file.size <= fileOptions.maxSize!);
    }

    // Limit to single file if not multiple
    if (!fileOptions.multiple && files.length > 1) {
      files = [files[0]];
    }

    if (files.length > 0) {
      onDrop(files);
    }
  };

  // Attach handlers
  element.addEventListener('dragenter', handleDragEnter);
  element.addEventListener('dragover', handleDragOver);
  element.addEventListener('dragleave', handleDragLeave);
  element.addEventListener('drop', handleDrop);

  // Return cleanup function
  return () => {
    element.removeEventListener('dragenter', handleDragEnter);
    element.removeEventListener('dragover', handleDragOver);
    element.removeEventListener('dragleave', handleDragLeave);
    element.removeEventListener('drop', handleDrop);
    element.classList.remove('snap-file-drag-over');
  };
}

function hasFiles(e: DragEvent): boolean {
  if (!e.dataTransfer) return false;
  const types = e.dataTransfer.types;
  return types.includes('Files') || types.includes('application/x-moz-file');
}

function matchesAccept(file: File, accept: string[]): boolean {
  for (const pattern of accept) {
    if (pattern.startsWith('.')) {
      if (file.name.toLowerCase().endsWith(pattern.toLowerCase())) {
        return true;
      }
      continue;
    }
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1);
      if (file.type.startsWith(prefix)) {
        return true;
      }
      continue;
    }
    if (file.type === pattern) {
      return true;
    }
  }
  return false;
}
