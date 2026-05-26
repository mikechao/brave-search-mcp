import type { PreInterceptorResult, ToolInterceptor, ToolInterceptorContext } from './tool-helpers.js';

export interface GuardrailConfig {
  requestLimit: number; // positive integer; maximum allowed non-fallback calls
  windowMs: number; // 0 = process-lifetime cap (no pruning); positive = rolling window in ms
  cooldownMs: number; // 0 = no extra cooldown; positive = block duration after limit hit in ms
}

export class UsageGuardrailInterceptor implements ToolInterceptor {
  private requestTimestamps: number[] = [];
  private cooldownUntilMs: number = 0;

  constructor(private readonly config: GuardrailConfig) {}

  async before(context: ToolInterceptorContext): Promise<PreInterceptorResult | void> {
    // 1. Skip fallback calls — do not increment or check limits.
    if (context.isFallback)
      return;

    const now = Date.now();

    // 2. Active cooldown check — block immediately if cooldown is still in effect.
    if (now < this.cooldownUntilMs) {
      const remainingSec = Math.ceil((this.cooldownUntilMs - now) / 1000);
      return {
        allow: false,
        reason: `Request limit exceeded. Cooldown active; retry in ${remainingSec}s.`,
        code: 'RATE_LIMITED',
      };
    }

    // 3. Rolling window pruning — drop timestamps older than the window.
    if (this.config.windowMs > 0)
      this.requestTimestamps = this.requestTimestamps.filter(ts => ts > now - this.config.windowMs);

    // 4. Limit check — if we are at or over the limit, deny.
    //    Cooldown is only meaningful with a rolling window. For a process-lifetime
    //    cap (windowMs === 0) timestamps are never pruned, so after a cooldown
    //    expires the limit is still exhausted — a retry hint would be misleading.
    if (this.requestTimestamps.length >= this.config.requestLimit) {
      const rollingMode = this.config.windowMs > 0;
      const cooldownHint = rollingMode && this.config.cooldownMs > 0
        ? ` Retry after ${Math.ceil(this.config.cooldownMs / 1000)}s.`
        : '';
      if (rollingMode)
        this.cooldownUntilMs = now + this.config.cooldownMs;
      return {
        allow: false,
        reason: `Request limit of ${this.config.requestLimit} exceeded.${cooldownHint}`,
        code: 'RATE_LIMITED',
      };
    }

    // 5. Allow — record this call.
    this.requestTimestamps.push(now);
  }
}
