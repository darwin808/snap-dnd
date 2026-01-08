/**
 * Custom DataTransfer implementation for passing data during drag operations
 * Not the browser's native DataTransfer
 */
import type { DataTransfer as IDataTransfer } from '../types/index.js';

export class SnapDataTransfer implements IDataTransfer {
  private _data = new Map<string, unknown>();

  /**
   * Set data for a given type
   */
  setData(type: string, value: unknown): void {
    this._data.set(type, value);
  }

  /**
   * Get data for a given type
   */
  getData<T = unknown>(type: string): T | undefined {
    return this._data.get(type) as T | undefined;
  }

  /**
   * Check if a type exists
   */
  hasType(type: string): boolean {
    return this._data.has(type);
  }

  /**
   * Get all registered types
   */
  get types(): string[] {
    return [...this._data.keys()];
  }

  /**
   * Clear all data
   */
  clear(): void {
    this._data.clear();
  }

  /**
   * Create a copy of this transfer
   */
  clone(): SnapDataTransfer {
    const copy = new SnapDataTransfer();
    for (const [key, value] of this._data) {
      copy.setData(key, value);
    }
    return copy;
  }
}
