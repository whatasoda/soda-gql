import type { CoordinatorEvent, CoordinatorListener } from "./types.js";

/**
 * Manages event subscriptions for a coordinator.
 */
export class SubscriptionManager {
  private listeners = new Set<CoordinatorListener>();
  private disposed = false;

  /**
   * Subscribe to coordinator events.
   * @returns Unsubscribe function
   */
  subscribe(listener: CoordinatorListener): () => void {
    if (this.disposed) {
      throw new Error("Cannot subscribe to disposed coordinator");
    }

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit an event to all subscribers.
   */
  emit(event: CoordinatorEvent): void {
    if (this.disposed && event.type !== "disposed") {
      return;
    }

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        // Log but don't break other listeners
        console.error("Error in coordinator listener:", error);
      }
    }
  }

  /**
   * Dispose all subscriptions.
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.emit({ type: "disposed" });
    this.listeners.clear();
  }

  /**
   * Get number of active listeners.
   */
  get listenerCount(): number {
    return this.listeners.size;
  }
}
