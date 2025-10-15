import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { HistoryEntry, PersistenceAdapter, State } from '../state';

interface FileBackedAdapterOptions {
  statePath: string;
  historyPath: string;
}

function createFileBackedAdapter(options: FileBackedAdapterOptions): PersistenceAdapter {
  return {
    async loadState() {
      try {
        const content = await fs.readFile(options.statePath, 'utf-8');
        return JSON.parse(content) as State;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return undefined;
        }
        throw error;
      }
    },
    async saveState(state) {
      await fs.mkdir(path.dirname(options.statePath), { recursive: true });
      await fs.writeFile(options.statePath, JSON.stringify(state), 'utf-8');
    },
    async appendHistory(entry) {
      const history = await this.loadHistory();
      history.push(entry);
      await fs.mkdir(path.dirname(options.historyPath), { recursive: true });
      await fs.writeFile(options.historyPath, JSON.stringify(history), 'utf-8');
    },
    async loadHistory() {
      try {
        const content = await fs.readFile(options.historyPath, 'utf-8');
        return JSON.parse(content) as HistoryEntry[];
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return [];
        }
        throw error;
      }
    },
    async clear() {
      await Promise.all([
        fs.rm(options.statePath, { force: true }),
        fs.rm(options.historyPath, { force: true }),
      ]);
    },
  } satisfies PersistenceAdapter;
}

function createInMemoryAdapter(): PersistenceAdapter {
  let storedState: State | undefined;
  let storedHistory: HistoryEntry[] = [];
  return {
    async loadState() {
      return storedState;
    },
    async saveState(state) {
      storedState = JSON.parse(JSON.stringify(state));
    },
    async appendHistory(entry) {
      storedHistory = [...storedHistory, JSON.parse(JSON.stringify(entry))];
    },
    async loadHistory() {
      return storedHistory.map((entry) => JSON.parse(JSON.stringify(entry)));
    },
    async clear() {
      storedState = undefined;
      storedHistory = [];
    },
  } satisfies PersistenceAdapter;
}

async function importStateModule() {
  const module = await import('../state');
  return module;
}

describe('state store persistence', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('persists state across module reloads', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'eco-state-'));
    const adapterPaths = {
      statePath: path.join(baseDir, 'state.json'),
      historyPath: path.join(baseDir, 'history.json'),
    };

    {
      const stateModule = await importStateModule();
      stateModule.configureState({ adapter: createFileBackedAdapter(adapterPaths) });
      await stateModule.setState({ currentEnv: 'persisted' });
      expect((await stateModule.getState()).currentEnv).toBe('persisted');
    }

    vi.resetModules();

    {
      const stateModule = await importStateModule();
      stateModule.configureState({ adapter: createFileBackedAdapter(adapterPaths) });
      expect((await stateModule.getState()).currentEnv).toBe('persisted');
    }
  });

  it('records history transitions and replays them', async () => {
    const stateModule = await importStateModule();
    const adapter = createInMemoryAdapter();
    stateModule.configureState({ adapter, initialState: { currentEnv: 'alpha' } });

    await stateModule.setState({ currentEnv: 'beta' });
    await stateModule.setState({ currentEnv: 'gamma' });

    const history = await stateModule.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].previousState.currentEnv).toBe('alpha');
    expect(history[0].nextState.currentEnv).toBe('beta');
    expect(history[1].previousState.currentEnv).toBe('beta');
    expect(history[1].nextState.currentEnv).toBe('gamma');

    const cutoff = history[0].timestamp;
    const later = await stateModule.getHistorySince(cutoff);
    expect(later).toHaveLength(1);
    expect(later[0].nextState.currentEnv).toBe('gamma');
  });
});
