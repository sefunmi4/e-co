import type { BridgeRateLimitConfig } from "./config";

interface CounterState {
  count: number;
  resetAt: number;
}

interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  count: number;
}

export type BridgeLimitScope = "user" | "room" | "user_room";

export interface BridgeLimitDecision {
  allowed: boolean;
  scope?: BridgeLimitScope;
  limit?: number;
  remaining?: number;
  resetAt?: number;
}

const now = () => Date.now();

const consume = (
  map: Map<string, CounterState>,
  key: string,
  limit: number,
  windowMs: number,
  tokens: number,
): ConsumeResult => {
  const timestamp = now();
  let counter = map.get(key);
  if (!counter || timestamp >= counter.resetAt) {
    counter = { count: 0, resetAt: timestamp + windowMs };
    map.set(key, counter);
  }

  if (counter.count + tokens > limit) {
    return {
      allowed: false,
      remaining: Math.max(0, limit - counter.count),
      resetAt: counter.resetAt,
      count: counter.count,
    };
  }

  counter.count += tokens;
  return {
    allowed: true,
    remaining: Math.max(0, limit - counter.count),
    resetAt: counter.resetAt,
    count: counter.count,
  };
};

export interface BurstLimiterOptions extends BridgeRateLimitConfig {}

export class BurstLimiter {
  private readonly perUserCounters = new Map<string, CounterState>();

  private readonly perRoomCounters = new Map<string, CounterState>();

  private readonly perUserRoomCounters = new Map<string, CounterState>();

  private readonly windowMs: number;

  private readonly perUser?: number;

  private readonly perRoom?: number;

  private readonly perUserInRoom?: number;

  constructor(options: BurstLimiterOptions) {
    this.windowMs = options.windowMs;
    this.perUser = options.perUser;
    this.perRoom = options.perRoom;
    this.perUserInRoom = options.perUserInRoom;
  }

  public check(
    userId: string,
    roomId: string | null,
    tokens = 1,
  ): BridgeLimitDecision {
    if (tokens <= 0) {
      return { allowed: true };
    }

    if (!userId) {
      throw new Error("burst limiter requires a user identifier");
    }

    const windowMs = this.windowMs;

    if (this.perUser && this.perUser > 0) {
      const result = consume(
        this.perUserCounters,
        userId,
        this.perUser,
        windowMs,
        tokens,
      );
      if (!result.allowed) {
        return {
          allowed: false,
          scope: "user",
          limit: this.perUser,
          remaining: result.remaining,
          resetAt: result.resetAt,
        };
      }
    }

    if (roomId) {
      if (this.perUserInRoom && this.perUserInRoom > 0) {
        const key = `${roomId}::${userId}`;
        const result = consume(
          this.perUserRoomCounters,
          key,
          this.perUserInRoom,
          windowMs,
          tokens,
        );
        if (!result.allowed) {
          return {
            allowed: false,
            scope: "user_room",
            limit: this.perUserInRoom,
            remaining: result.remaining,
            resetAt: result.resetAt,
          };
        }
      }

      if (this.perRoom && this.perRoom > 0) {
        const result = consume(
          this.perRoomCounters,
          roomId,
          this.perRoom,
          windowMs,
          tokens,
        );
        if (!result.allowed) {
          return {
            allowed: false,
            scope: "room",
            limit: this.perRoom,
            remaining: result.remaining,
            resetAt: result.resetAt,
          };
        }
      }
    }

    return { allowed: true };
  }
}
