import { afterEach, describe, expect, it } from "vitest";
import {
  getSandboxBackendFactory,
  getSandboxBackendManager,
  registerSandboxBackend,
  requireSandboxBackendFactory,
} from "./backend.js";

describe("sandbox backend registry", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const fn of cleanups.splice(0)) {
      fn();
    }
  });

  it("registers and restores backend factories", () => {
    const factory = async () => {
      throw new Error("not used");
    };
    const restore = registerSandboxBackend("test-backend", factory);
    cleanups.push(restore);
    expect(getSandboxBackendFactory("test-backend")).toBe(factory);
    restore();
    cleanups.length = 0;
    expect(getSandboxBackendFactory("test-backend")).toBeNull();
  });

  it("registers backend managers alongside factories", () => {
    const factory = async () => {
      throw new Error("not used");
    };
    const manager = {
      describeRuntime: async () => ({
        running: true,
        configLabelMatch: true,
      }),
      removeRuntime: async () => {},
    };
    const restore = registerSandboxBackend("test-managed", {
      factory,
      manager,
    });
    cleanups.push(restore);
    expect(getSandboxBackendFactory("test-managed")).toBe(factory);
    expect(getSandboxBackendManager("test-managed")).toBe(manager);
    restore();
    cleanups.length = 0;
    expect(getSandboxBackendManager("test-managed")).toBeNull();
  });

  it("requireSandboxBackendFactory throws for unregistered backend", () => {
    expect(() => requireSandboxBackendFactory("nonexistent")).toThrow(
      'Sandbox backend "nonexistent" is not registered.',
    );
  });

  it("requireSandboxBackendFactory returns factory for registered backend", () => {
    const factory = async () => {
      throw new Error("not used");
    };
    const restore = registerSandboxBackend("test-require", factory);
    cleanups.push(restore);
    expect(requireSandboxBackendFactory("test-require")).toBe(factory);
  });

  it("uses globalThis so registrations survive across module instances", () => {
    // Simulate what happens when a plugin loaded via Jiti writes to the
    // globalThis-backed map directly — core's lookup must see it.
    const key = Symbol.for("openclaw.sandboxBackendFactories");
    const factory = async () => {
      throw new Error("not used");
    };
    const map = (globalThis as Record<symbol, unknown>)[key] as Map<string, { factory: unknown }>;
    expect(map).toBeInstanceOf(Map);

    // Write via the global map (simulating a separate module instance)
    map.set("cross-instance-test", { factory });
    cleanups.push(() => map.delete("cross-instance-test"));

    // Core lookup must find it
    expect(getSandboxBackendFactory("cross-instance-test")).toBe(factory);
    expect(requireSandboxBackendFactory("cross-instance-test")).toBe(factory);
  });

  it("normalizes backend ids to lowercase", () => {
    const factory = async () => {
      throw new Error("not used");
    };
    const restore = registerSandboxBackend("MyBackend", factory);
    cleanups.push(restore);
    expect(getSandboxBackendFactory("mybackend")).toBe(factory);
    expect(getSandboxBackendFactory("MYBACKEND")).toBe(factory);
  });
});
