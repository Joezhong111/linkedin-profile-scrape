import { describe, it, expect } from 'vitest';

describe('Example Test', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should check for truthy values', () => {
    expect(true).toBeTruthy();
    expect('hello').toBeTruthy();
    expect(0).toBeFalsy();
  });
});
