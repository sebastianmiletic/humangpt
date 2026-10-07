import { describe, expect, it } from 'vitest';
import { UsageGuard } from '../server/usage';

describe('usage guards', () => {
  it('blocks concurrent requests from one IP and releases the slot', () => {
    const guard = new UsageGuard(10, 4);
    const release = guard.begin('ip1');
    expect(() => guard.begin('ip1')).toThrow('previous rewrite');
    release();
    expect(() => guard.begin('ip1')).not.toThrow();
  });
  it('caps global concurrent provider calls', () => {
    const guard = new UsageGuard(10, 1);
    const release = guard.begin('ip1');
    expect(() => guard.begin('ip2')).toThrow('slots are busy');
    release();
    expect(() => guard.begin('ip2')).not.toThrow();
  });
  it('uses an instance-wide daily cap and resets at the UTC day boundary', () => {
    let now = 0;
    const guard = new UsageGuard(1, 4, () => now);
    guard.begin('ip1')();
    expect(() => guard.begin('ip2')).toThrow('daily rewriting limit');
    now = 86_400_000;
    expect(() => guard.begin('ip2')).not.toThrow();
  });
  it('makes release idempotent without deleting a later request slot', () => {
    const guard = new UsageGuard(10, 4);
    const release = guard.begin('ip1');
    release();
    guard.begin('ip1');
    release();
    expect(() => guard.begin('ip1')).toThrow('previous rewrite');
  });
});
