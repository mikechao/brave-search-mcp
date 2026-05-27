import type { PreInterceptorResult, ToolInterceptor, ToolInterceptorContext } from './tool-helpers.js';

export interface GuardrailConfig {
  requestLimit: number; // positive integer; maximum allowed non-fallback calls
  windowMs: number; // 0 = process-lifetime cap (no pruning); positive = rolling window in ms
  cooldownMs: number; // 0 = no extra cooldown; positive = block duration after limit hit in ms
}

interface CounterState {
  requestTimestamps: number[];
  cooldownUntilMs: number;
}

export class UsageGuardrailInterceptor implements ToolInterceptor {
  private readonly buckets = new Map<string, CounterState>();

  constructor(private readonly config: GuardrailConfig) {}

  async before(context: ToolInterceptorContext): Promise<PreInterceptorResult | void> {
    // 1. Skip fallback calls — do not increment or check limits.
    if (context.isFallback)
      return;

    const now = Date.now();
    const state = this.getBucketState(context);

    // 2. Active cooldown check — block immediately if cooldown is still in effect.
    if (now < state.cooldownUntilMs) {
      const remainingSec = Math.ceil((state.cooldownUntilMs - now) / 1000);
      return {
        allow: false,
        reason: `Request limit exceeded. Cooldown active; retry in ${remainingSec}s.`,
        code: 'RATE_LIMITED',
      };
    }

    // 3. Rolling window pruning — drop timestamps older than the window.
    if (this.config.windowMs > 0)
      state.requestTimestamps = state.requestTimestamps.filter(ts => ts > now - this.config.windowMs);

    // 4. Limit check — if we are at or over the limit, deny.
    //    Cooldown is only meaningful with a rolling window. For a process-lifetime
    //    cap (windowMs === 0) timestamps are never pruned, so after a cooldown
    //    expires the limit is still exhausted — a retry hint would be misleading.
    if (state.requestTimestamps.length >= this.config.requestLimit) {
      const rollingMode = this.config.windowMs > 0;
      const cooldownHint = rollingMode && this.config.cooldownMs > 0
        ? ` Retry after ${Math.ceil(this.config.cooldownMs / 1000)}s.`
        : '';
      if (rollingMode)
        state.cooldownUntilMs = now + this.config.cooldownMs;
      return {
        allow: false,
        reason: `Request limit of ${this.config.requestLimit} exceeded.${cooldownHint}`,
        code: 'RATE_LIMITED',
      };
    }

    // 5. Allow — record this call.
    state.requestTimestamps.push(now);
  }

  private getBucketState(context: ToolInterceptorContext): CounterState {
    const key = this.getBucketKey(context);
    let state = this.buckets.get(key);
    if (!state) {
      state = {
        requestTimestamps: [],
        cooldownUntilMs: 0,
      };
      this.buckets.set(key, state);
    }
    return state;
  }

  private getBucketKey(context: ToolInterceptorContext): string {
    return context.callerId ?? `anonymous:${context.transport}`;
  }
}
