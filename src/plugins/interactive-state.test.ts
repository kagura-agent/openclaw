import { describe, expect, it, vi, beforeEach } from "vitest";

describe("clearPluginInteractiveHandlersState", () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear the global singleton so each test starts fresh
    const key = Symbol.for("openclaw.pluginInteractiveState");
    const g = globalThis as Record<symbol, unknown>;
    delete g[key];
  });

  it("should not throw when state fields are populated", async () => {
    const mod = await import("./interactive-state.js");
    // Populate some state first
    mod.getPluginInteractiveHandlersState().set("test", {} as never);
    expect(() => mod.clearPluginInteractiveHandlersState()).not.toThrow();
    expect(mod.getPluginInteractiveHandlersState().size).toBe(0);
  });

  it("should not throw when callbackDedupe is undefined", async () => {
    // Simulate a corrupted/partial global singleton where callbackDedupe is undefined
    const key = Symbol.for("openclaw.pluginInteractiveState");
    (globalThis as Record<symbol, unknown>)[key] = {
      interactiveHandlers: new Map(),
      callbackDedupe: undefined,
      inflightCallbackDedupe: new Set(),
    };
    const mod = await import("./interactive-state.js");
    expect(() => mod.clearPluginInteractiveHandlersState()).not.toThrow();
  });

  it("should not throw when inflightCallbackDedupe is undefined", async () => {
    const key = Symbol.for("openclaw.pluginInteractiveState");
    (globalThis as Record<symbol, unknown>)[key] = {
      interactiveHandlers: new Map(),
      callbackDedupe: { clear: () => {} },
      inflightCallbackDedupe: undefined,
    };
    const mod = await import("./interactive-state.js");
    expect(() => mod.clearPluginInteractiveHandlersState()).not.toThrow();
  });
});
