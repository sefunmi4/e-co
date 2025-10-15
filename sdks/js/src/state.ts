import { info } from './logger';

export interface State {
  currentEnv: string;
}

export interface HistoryEntry {
  timestamp: number;
  previousState: State;
  nextState: State;
  patch: Partial<State>;
}

export interface PersistenceAdapter {
  loadState(): Promise<State | undefined>;
  saveState(state: State): Promise<void>;
  appendHistory(entry: HistoryEntry): Promise<void>;
  loadHistory(): Promise<HistoryEntry[]>;
  clear?(): Promise<void>;
}

interface StateStoreConfiguration {
  adapter: PersistenceAdapter;
  initialState: State;
}

const DEFAULT_STATE: State = { currentEnv: '' };
const STATE_STORAGE_KEY = 'eco:state';
const HISTORY_STORAGE_KEY = 'eco:state-history';

let configuration: StateStoreConfiguration | null = null;
let state: State = { ...DEFAULT_STATE };
let history: HistoryEntry[] = [];
let initializationPromise: Promise<void> | null = null;
let lastTimestamp = 0;

function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function cloneState<T extends object>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

class BrowserStorageAdapter implements PersistenceAdapter {
  async loadState(): Promise<State | undefined> {
    try {
      const serialized = window.localStorage.getItem(STATE_STORAGE_KEY);
      return serialized ? (JSON.parse(serialized) as State) : undefined;
    } catch (error) {
      info('BrowserStorageAdapter failed to load state', error);
      return undefined;
    }
  }

  async saveState(next: State): Promise<void> {
    try {
      window.localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      info('BrowserStorageAdapter failed to save state', error);
    }
  }

  async appendHistory(entry: HistoryEntry): Promise<void> {
    try {
      const existing = await this.loadHistory();
      existing.push(entry);
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(existing));
    } catch (error) {
      info('BrowserStorageAdapter failed to append history', error);
    }
  }

  async loadHistory(): Promise<HistoryEntry[]> {
    try {
      const serialized = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      return serialized ? (JSON.parse(serialized) as HistoryEntry[]) : [];
    } catch (error) {
      info('BrowserStorageAdapter failed to load history', error);
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      window.localStorage.removeItem(STATE_STORAGE_KEY);
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (error) {
      info('BrowserStorageAdapter failed to clear data', error);
    }
  }
}

class NodeFileAdapter implements PersistenceAdapter {
  private readonly statePath: string;
  private readonly historyPath: string;
  private readonly fsPromise: Promise<typeof import('fs/promises')>;

  constructor(statePath?: string, historyPath?: string) {
    const cwd = typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '.';
    this.statePath = statePath ?? `${cwd}/.eco/state.json`;
    this.historyPath = historyPath ?? `${cwd}/.eco/history.json`;
    this.fsPromise = import('fs/promises');
  }

  private async ensureDirectory(filePath: string) {
    const fs = await this.fsPromise;
    const { dirname } = await import('path');
    await fs.mkdir(dirname(filePath), { recursive: true });
  }

  private async readJson<T>(filePath: string): Promise<T | undefined> {
    try {
      const fs = await this.fsPromise;
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
        return undefined;
      }
      info('NodeFileAdapter failed to read file', { filePath, error });
      return undefined;
    }
  }

  private async writeJson<T>(filePath: string, payload: T): Promise<void> {
    const fs = await this.fsPromise;
    await this.ensureDirectory(filePath);
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  async loadState(): Promise<State | undefined> {
    return this.readJson<State>(this.statePath);
  }

  async saveState(next: State): Promise<void> {
    try {
      await this.writeJson(this.statePath, next);
    } catch (error) {
      info('NodeFileAdapter failed to save state', { error });
    }
  }

  async appendHistory(entry: HistoryEntry): Promise<void> {
    const history = await this.loadHistory();
    history.push(entry);
    try {
      await this.writeJson(this.historyPath, history);
    } catch (error) {
      info('NodeFileAdapter failed to append history', { error });
    }
  }

  async loadHistory(): Promise<HistoryEntry[]> {
    return (await this.readJson<HistoryEntry[]>(this.historyPath)) ?? [];
  }

  async clear(): Promise<void> {
    const fs = await this.fsPromise;
    await Promise.all([
      fs.rm(this.statePath, { force: true }),
      fs.rm(this.historyPath, { force: true }),
    ]);
  }
}

function createDefaultAdapter(): PersistenceAdapter {
  if (configuration?.adapter) {
    return configuration.adapter;
  }

  if (isBrowserEnvironment()) {
    return new BrowserStorageAdapter();
  }

  return new NodeFileAdapter();
}

function ensureConfiguration(): StateStoreConfiguration {
  if (!configuration) {
    configuration = {
      adapter: createDefaultAdapter(),
      initialState: { ...DEFAULT_STATE },
    };
  }

  return configuration;
}

async function initialize(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const { adapter, initialState } = ensureConfiguration();
      const persistedState = await adapter.loadState();
      state = persistedState ? { ...initialState, ...persistedState } : cloneState(initialState);
      history = await adapter.loadHistory();
      lastTimestamp = history.reduce((max, entry) => Math.max(max, entry.timestamp), 0);
      info('State initialized', { persisted: Boolean(persistedState), historyLength: history.length });
    })();
  }

  await initializationPromise;
}

function sanitizePatch(partial: Partial<State>): Partial<State> {
  return JSON.parse(JSON.stringify(partial)) as Partial<State>;
}

export function configureState(options: { adapter?: PersistenceAdapter; initialState?: State } = {}): void {
  const adapter = options.adapter ?? createDefaultAdapter();
  const initialState = options.initialState ?? { ...DEFAULT_STATE };
  configuration = { adapter, initialState };
  state = cloneState(initialState);
  history = [];
  initializationPromise = null;
  lastTimestamp = 0;
}

export async function setState(partial: Partial<State>): Promise<void> {
  await initialize();

  const previousState = cloneState(state);
  state = { ...state, ...partial };
  const timestamp = (() => {
    const now = Date.now();
    if (now <= lastTimestamp) {
      lastTimestamp += 1;
      return lastTimestamp;
    }
    lastTimestamp = now;
    return now;
  })();
  const entry: HistoryEntry = {
    timestamp,
    previousState,
    nextState: cloneState(state),
    patch: sanitizePatch(partial),
  };

  const { adapter } = ensureConfiguration();
  await Promise.all([
    adapter.saveState(state),
    adapter.appendHistory(entry),
  ]);

  history.push(entry);
  info('State updated', partial);
}

export async function getState(): Promise<State> {
  await initialize();
  info('State retrieved', state);
  return cloneState(state);
}

export async function getHistory(): Promise<HistoryEntry[]> {
  await initialize();
  return history.map((entry) => ({
    ...entry,
    previousState: cloneState(entry.previousState),
    nextState: cloneState(entry.nextState),
    patch: sanitizePatch(entry.patch),
  }));
}

export async function getHistorySince(timestamp: number): Promise<HistoryEntry[]> {
  const entries = await getHistory();
  return entries.filter((entry) => entry.timestamp > timestamp);
}

export async function clearState(): Promise<void> {
  const { adapter, initialState } = ensureConfiguration();
  await adapter.clear?.();
  state = cloneState(initialState);
  history = [];
  initializationPromise = null;
  lastTimestamp = 0;
}
