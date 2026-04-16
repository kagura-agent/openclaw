import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const entryPoint = resolve(repoRoot, "openclaw.mjs");

describe("root guard in openclaw.mjs", () => {
  it("contains the root-user guard that checks getuid and OPENCLAW_ALLOW_ROOT", () => {
    const content = readFileSync(entryPoint, "utf8");
    expect(content).toContain("ensureNotRoot");
    expect(content).toContain("OPENCLAW_ALLOW_ROOT");
    expect(content).toContain("process.getuid() === 0");
    // Guard runs before any command loading
    const guardIndex = content.indexOf("ensureNotRoot()");
    const importIndex = content.indexOf("tryImport");
    expect(guardIndex).toBeLessThan(importIndex);
  });

  it("guard exits with a clear error message when running as root", () => {
    const content = readFileSync(entryPoint, "utf8");
    expect(content).toContain("refusing to run as root");
    expect(content).toContain("OPENCLAW_ALLOW_ROOT=1");
  });
});
