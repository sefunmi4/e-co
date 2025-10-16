export interface BridgeRateLimitConfig {
  /** Rolling window in milliseconds used for burst tracking. */
  windowMs: number;
  /** Maximum number of events a single user can emit across all rooms per window. */
  perUser?: number;
  /** Maximum number of events that can target a specific room per window (across users). */
  perRoom?: number;
  /** Maximum number of events a user can emit to a specific room per window. */
  perUserInRoom?: number;
  /** Events that should be subject to throttling. */
  trackedEvents?: string[];
  /** Events that should be ignored when throttling. */
  excludedEvents?: string[];
}

export interface BridgeControlsConfig extends BridgeRateLimitConfig {
  /**
   * Flag that gates the bridge. When disabled, events are short-circuited before
   * hitting downstream handlers.
   */
  enabled: boolean;
  /** Optional path to a JSON file that can toggle the bridge at runtime. */
  flagFile?: string | null;
}

const DEFAULT_WINDOW_MS = 10_000;
const DEFAULT_PER_USER = 60;
const DEFAULT_PER_ROOM = 200;
const DEFAULT_PER_USER_ROOM = 40;

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null) return fallback;
  const normalised = value.trim().toLowerCase();
  if (["false", "0", "off", "no"].includes(normalised)) return false;
  if (["true", "1", "on", "yes"].includes(normalised)) return true;
  return fallback;
};

const parseList = (value: string | undefined): string[] | undefined => {
  if (!value) return undefined;
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const loadBridgeControlsFromEnv = (
  env: NodeJS.ProcessEnv = process.env,
): BridgeControlsConfig => {
  const enabled = parseBoolean(env.REALTIME_BRIDGE_ENABLED, true) &&
    !parseBoolean(env.REALTIME_BRIDGE_DISABLED, false);

  const windowMs = parseNumber(env.REALTIME_BRIDGE_WINDOW_MS, DEFAULT_WINDOW_MS);
  const perUser = parseNumber(env.REALTIME_BRIDGE_MAX_EVENTS_PER_USER, DEFAULT_PER_USER);
  const perRoom = parseNumber(env.REALTIME_BRIDGE_MAX_EVENTS_PER_ROOM, DEFAULT_PER_ROOM);
  const perUserInRoom = parseNumber(
    env.REALTIME_BRIDGE_MAX_EVENTS_PER_USER_ROOM,
    DEFAULT_PER_USER_ROOM,
  );

  const trackedEvents = parseList(env.REALTIME_BRIDGE_TRACKED_EVENTS);
  const excludedEvents = parseList(env.REALTIME_BRIDGE_EXCLUDED_EVENTS);

  const flagFile = env.REALTIME_BRIDGE_FLAG_FILE ?? null;

  return {
    enabled,
    windowMs,
    perUser,
    perRoom,
    perUserInRoom,
    trackedEvents,
    excludedEvents,
    flagFile,
  };
};

