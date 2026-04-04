import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "./config.js";
import { ensurePluginAllowlisted } from "./plugins-allowlist.js";

describe("ensurePluginAllowlisted", () => {
  it("initializes allow to [pluginId] when plugins.allow is undefined", () => {
    const cfg = { plugins: {} } as OpenClawConfig;
    const result = ensurePluginAllowlisted(cfg, "my-plugin");
    expect(result.plugins?.allow).toEqual(["my-plugin"]);
  });

  it("initializes plugins.allow to [pluginId] when plugins is undefined", () => {
    const cfg = {} as OpenClawConfig;
    const result = ensurePluginAllowlisted(cfg, "my-plugin");
    expect(result.plugins?.allow).toEqual(["my-plugin"]);
  });

  it("appends pluginId to an existing allow array", () => {
    const cfg = { plugins: { allow: ["other-plugin"] } } as OpenClawConfig;
    const result = ensurePluginAllowlisted(cfg, "my-plugin");
    expect(result.plugins?.allow).toEqual(["other-plugin", "my-plugin"]);
  });

  it("returns cfg unchanged when pluginId is already present", () => {
    const cfg = { plugins: { allow: ["my-plugin"] } } as OpenClawConfig;
    const result = ensurePluginAllowlisted(cfg, "my-plugin");
    expect(result).toBe(cfg);
  });

  it("preserves existing items when appending", () => {
    const cfg = { plugins: { allow: ["a", "b"] } } as OpenClawConfig;
    const result = ensurePluginAllowlisted(cfg, "c");
    expect(result.plugins?.allow).toEqual(["a", "b", "c"]);
  });
});
