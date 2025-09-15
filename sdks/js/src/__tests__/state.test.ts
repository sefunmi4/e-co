import { setState, getState } from '../state';
import { describe, it, expect } from 'vitest';

describe('state store', () => {
  it('updates and retrieves state', () => {
    setState({ currentEnv: 'test' });
    expect(getState().currentEnv).toBe('test');
  });
});
