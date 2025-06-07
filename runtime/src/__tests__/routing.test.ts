import { handleGesture } from '../gestures';
import { register, dispatch } from '../commands';
import { describe, it, expect } from 'vitest';

describe('runtime routing', () => {
  it('maps gestures to command names', () => {
    expect(handleGesture('swipe-left')).toBe('prev-env');
    expect(handleGesture('tap')).toBe('select');
  });

  it('routes dispatched commands to handlers', () => {
    const calls: string[] = [];
    register('test', (cmd) => calls.push(cmd.type));
    dispatch({ type: 'test' });
    expect(calls).toEqual(['test']);
  });
});
