import { ServiceUnavailableException } from "@nestjs/common";

export class WriteBusyError extends ServiceUnavailableException {
  constructor(
    public readonly reason: "queue_full" | "queue_timeout" | "shutdown",
  ) {
    super("O serviço está temporariamente ocupado. Tente novamente.");
  }
}
type Waiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
/** One writer per SQLite process. Admission is bounded; active work is never detached. */
export class WriteGate {
  readonly concurrency = 1;
  private active = false;
  private stopped = false;
  private queue: Waiter[] = [];
  private drained?: () => void;
  private closing?: Promise<void>;
  constructor(
    readonly capacity = 16,
    readonly waitMs = 1000,
  ) {}
  private acquire(): Promise<void> {
    if (this.stopped) return Promise.reject(new WriteBusyError("shutdown"));
    if (!this.active) {
      this.active = true;
      return Promise.resolve();
    }
    if (this.queue.length >= this.capacity)
      return Promise.reject(new WriteBusyError("queue_full"));
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.queue = this.queue.filter((item) => item !== waiter);
          reject(new WriteBusyError("queue_timeout"));
        }, this.waitMs),
      };
      this.queue.push(waiter);
    });
  }
  async run<T>(work: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await work();
    } finally {
      const next = this.queue.shift();
      if (next) {
        clearTimeout(next.timer);
        next.resolve();
      } else {
        this.active = false;
        this.drained?.();
      }
    }
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.stopped = true;
    for (const waiter of this.queue.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(new WriteBusyError("shutdown"));
    }
    this.closing = this.active
      ? new Promise<void>((resolve) => {
          this.drained = resolve;
        })
      : Promise.resolve();
    return this.closing;
  }
}
