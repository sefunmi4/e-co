import { describe, it, expect } from 'vitest';
import { setInferenceMode, getInferenceMode, addModel, listModels } from '../ai';

describe('ai utilities', () => {
  it('toggles inference mode', () => {
    setInferenceMode('online');
    expect(getInferenceMode()).toBe('online');
  });

  it('manages models', () => {
    addModel({ id: 'm1', name: 'Test', status: 'stopped' });
    expect(listModels().length).toBe(1);
  });
});
