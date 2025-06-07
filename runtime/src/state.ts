// simple in-memory state store
export interface State {
  currentEnv: string;
}

let state: State = { currentEnv: '' };

export function setState(partial: Partial<State>) {
  state = { ...state, ...partial };
}

export function getState(): State {
  return state;
}

// TODO: replace with persistent/shared state across clients
