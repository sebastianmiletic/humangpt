import { AppError } from './errors';

// In-memory limits are intentionally scoped to a single server instance.
// Use a shared store and authentication before running multiple replicas.
export class UsageGuard {
  private day = -1;
  private used = 0;
  private active = new Set<string>();

  constructor(
    private readonly dailyLimit: number,
    private readonly concurrencyLimit: number,
    private readonly now: () => number = Date.now,
  ) {}

  begin(ip: string): () => void {
    const today = Math.floor(this.now() / 86_400_000);
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
    }
    if (this.active.has(ip)) {
      throw new AppError(429, 'already_running', 'Your previous rewrite is still running. Please wait before trying again.');
    }
    if (this.active.size >= this.concurrencyLimit) {
      throw new AppError(503, 'busy', 'All writing slots are busy. Try again in a moment.');
    }
    if (this.used >= this.dailyLimit) {
      throw new AppError(429, 'daily_limit', 'This site has reached its daily rewriting limit. Please try again tomorrow.');
    }

    this.used += 1;
    this.active.add(ip);
    let released = false;
    return () => {
      if (!released) this.active.delete(ip);
      released = true;
    };
  }
}
