import { describe, it, expect, vi } from 'vitest';
import { HistoryManager } from '../src/core/history';

describe('HistoryManager (Undo / Redo)', () => {
  it('executes commands and tracks undo/redo availability', () => {
    const mgr = new HistoryManager(10);
    let state = 0;

    expect(mgr.canUndo()).toBe(false);
    expect(mgr.canRedo()).toBe(false);

    mgr.execute({
      name: 'Add 1',
      redo: () => { state += 1; },
      undo: () => { state -= 1; },
    });

    expect(state).toBe(1);
    expect(mgr.canUndo()).toBe(true);
    expect(mgr.canRedo()).toBe(false);

    mgr.undo();
    expect(state).toBe(0);
    expect(mgr.canUndo()).toBe(false);
    expect(mgr.canRedo()).toBe(true);

    mgr.redo();
    expect(state).toBe(1);
    expect(mgr.canUndo()).toBe(true);
    expect(mgr.canRedo()).toBe(false);
  });

  it('notifies subscribers on history change', () => {
    const mgr = new HistoryManager(10);
    const listener = vi.fn();
    const unsubscribe = mgr.subscribe(listener);

    mgr.execute({
      name: 'Test',
      redo: () => {},
      undo: () => {},
    });

    expect(listener).toHaveBeenCalledTimes(1);

    mgr.undo();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    mgr.redo();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('caps history stack to maximum depth', () => {
    const mgr = new HistoryManager(3);
    for (let i = 1; i <= 5; i++) {
      mgr.record({
        name: `Action ${i}`,
        redo: () => {},
        undo: () => {},
      });
    }

    // Should only be able to undo 3 times
    expect(mgr.undo()).toBe(true);
    expect(mgr.undo()).toBe(true);
    expect(mgr.undo()).toBe(true);
    expect(mgr.undo()).toBe(false);
  });
});
