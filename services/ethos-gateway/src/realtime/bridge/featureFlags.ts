import { EventEmitter } from "events";
import { readFile } from "fs/promises";
import { watchFile } from "fs";
import { resolve } from "path";

export type BridgeFlagListener = (enabled: boolean) => void;

export interface BridgeFlagClient {
  isBridgeEnabled(): boolean;
  setBridgeEnabled(enabled: boolean): void;
  refresh(): Promise<void>;
  onChange(listener: BridgeFlagListener): () => void;
}

export interface BridgeFlagOptions {
  defaultEnabled?: boolean;
  envKey?: string;
  disabledEnvKey?: string;
  flagFile?: string | null;
  logger?: Pick<Console, "debug" | "info" | "warn" | "error">;
}

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null) return fallback;
  const normalised = value.trim().toLowerCase();
  if (["false", "0", "off", "no"].includes(normalised)) return false;
  if (["true", "1", "on", "yes"].includes(normalised)) return true;
  return fallback;
};

const loadFromEnv = (options: BridgeFlagOptions): boolean => {
  const enabledValue = options.envKey ? process.env[options.envKey] : undefined;
  const disabledValue = options.disabledEnvKey
    ? process.env[options.disabledEnvKey]
    : undefined;
  const defaultEnabled = options.defaultEnabled ?? true;
  const enabled = parseBoolean(enabledValue, defaultEnabled);
  const disabled = parseBoolean(disabledValue, false);
  return enabled && !disabled;
};

const loadFromFile = async (
  filePath: string,
  fallback: boolean,
  logger?: Pick<Console, "debug" | "info" | "warn" | "error">,
): Promise<boolean> => {
  try {
    const raw = await readFile(filePath, "utf8");
    if (!raw.trim()) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "boolean") {
        return parsed;
      }
      if (parsed && typeof parsed === "object") {
        if ("bridgeEnabled" in parsed && typeof parsed.bridgeEnabled === "boolean") {
          return parsed.bridgeEnabled;
        }
        if ("enabled" in parsed && typeof parsed.enabled === "boolean") {
          return parsed.enabled;
        }
      }
      logger?.warn?.("bridge flag file present but did not contain a boolean; falling back");
      return fallback;
    } catch (error) {
      logger?.warn?.(`failed to parse bridge flag file at ${filePath}: ${String(error)}`);
      return fallback;
    }
  } catch (error) {
    logger?.debug?.(`bridge flag file missing at ${filePath}: ${String(error)}`);
    return fallback;
  }
};

export const createBridgeFlagClient = (
  options: BridgeFlagOptions = {},
): BridgeFlagClient => {
  const emitter = new EventEmitter();
  const envOptions: BridgeFlagOptions = {
    envKey: options.envKey ?? "REALTIME_BRIDGE_ENABLED",
    disabledEnvKey: options.disabledEnvKey ?? "REALTIME_BRIDGE_DISABLED",
    defaultEnabled: options.defaultEnabled ?? true,
    flagFile: options.flagFile ?? null,
    logger: options.logger,
  };

  let enabled = loadFromEnv(envOptions);
  const filePath = envOptions.flagFile ? resolve(envOptions.flagFile) : null;

  const update = (next: boolean) => {
    if (enabled === next) return;
    enabled = next;
    emitter.emit("change", enabled);
  };

  const refreshFromFile = async (): Promise<boolean | null> => {
    if (!filePath) return null;
    const result = await loadFromFile(filePath, enabled, envOptions.logger);
    return result;
  };

  if (filePath) {
    // Trigger initial load from the file (if present) and watch for changes.
    refreshFromFile()
      .then((result) => {
        if (typeof result === "boolean") {
          const envEnabled = loadFromEnv(envOptions);
          update(envEnabled && result);
        }
      })
      .catch((error) => {
        envOptions.logger?.warn?.(
          `initial bridge flag refresh failed for ${filePath}: ${String(error)}`,
        );
      });

    try {
      watchFile(
        filePath,
        { persistent: false, interval: 1000 },
        () => {
          refreshFromFile()
            .then((result) => {
              if (typeof result === "boolean") {
                const envEnabled = loadFromEnv(envOptions);
                update(envEnabled && result);
              }
            })
            .catch((error) => {
              envOptions.logger?.warn?.(
                `bridge flag refresh failed for ${filePath}: ${String(error)}`,
              );
            });
        },
      );
    } catch (error) {
      envOptions.logger?.warn?.(
        `failed to watch bridge flag file at ${filePath}: ${String(error)}`,
      );
    }
  }

  return {
    isBridgeEnabled: () => enabled,
    setBridgeEnabled: (nextEnabled: boolean) => {
      update(nextEnabled);
    },
    refresh: async () => {
      // Always re-load env toggles first.
      const envEnabled = loadFromEnv(envOptions);
      let next = envEnabled;
      if (filePath) {
        try {
          const fileResult = await refreshFromFile();
          if (typeof fileResult === "boolean") {
            next = envEnabled && fileResult;
            update(next);
            return;
          }
        } catch (error) {
          envOptions.logger?.warn?.(
            `bridge flag refresh from file failed: ${String(error)}`,
          );
        }
      }
      update(next);
    },
    onChange: (listener: BridgeFlagListener) => {
      emitter.on("change", listener);
      return () => emitter.off("change", listener);
    },
  };
};
