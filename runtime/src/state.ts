// simple in-memory state store
import { info } from './logger';

export interface State {
  currentEnv: string;
}

let state: State = { currentEnv: '' };

export function setState(partial: Partial<State>) {
  state = { ...state, ...partial };
  info('State updated', partial);
}

export function getState(): State {
  info('State retrieved', state);
  return state;
}

// TODO: replace with persistent/shared state across clients
