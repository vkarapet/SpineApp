import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../../src/core/event-bus';

describe('EventBus', () => {
  it('should call listeners when events are emitted', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('test', handler);
    bus.emit('test', 'arg1', 'arg2');
    expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should support multiple listeners', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('test', h1);
    bus.on('test', h2);
    bus.emit('test');
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('should remove listeners with off()', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('test', handler);
    bus.off('test', handler);
    bus.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should remove listeners with returned unsubscribe function', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('test', handler);
    unsub();
    bus.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should not throw if handler errors', () => {
    const bus = new EventBus();
    bus.on('test', () => { throw new Error('oops'); });
    const good = vi.fn();
    bus.on('test', good);
    expect(() => bus.emit('test')).not.toThrow();
    expect(good).toHaveBeenCalled();
  });

  it('should clear all listeners', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('a', handler);
    bus.on('b', handler);
    bus.clear();
    bus.emit('a');
    bus.emit('b');
    expect(handler).not.toHaveBeenCalled();
  });
});
