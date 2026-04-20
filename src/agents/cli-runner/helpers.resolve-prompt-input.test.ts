import { describe, expect, it } from "vitest";
import type { CliBackendConfig } from "../../config/types.agent-defaults.js";
import { resolvePromptInput } from "./helpers.js";

function makeBackend(overrides: Partial<CliBackendConfig> = {}): CliBackendConfig {
  return { command: "claude", ...overrides };
}

describe("resolvePromptInput", () => {
  it("defaults to stdin for claude-cli backend", () => {
    const result = resolvePromptInput({
      backend: makeBackend(),
      prompt: "hello world",
      backendId: "claude-cli",
    });
    expect(result).toEqual({ stdin: "hello world" });
  });

  it("defaults to arg for non-claude-cli backends", () => {
    const result = resolvePromptInput({
      backend: makeBackend(),
      prompt: "hello world",
      backendId: "other-cli",
    });
    expect(result).toEqual({ argsPrompt: "hello world" });
  });

  it("defaults to arg when backendId is omitted", () => {
    const result = resolvePromptInput({
      backend: makeBackend(),
      prompt: "hello world",
    });
    expect(result).toEqual({ argsPrompt: "hello world" });
  });

  it("respects explicit input=arg for claude-cli", () => {
    const result = resolvePromptInput({
      backend: makeBackend({ input: "arg" }),
      prompt: "hello world",
      backendId: "claude-cli",
    });
    expect(result).toEqual({ argsPrompt: "hello world" });
  });

  it("respects explicit input=stdin for non-claude-cli", () => {
    const result = resolvePromptInput({
      backend: makeBackend({ input: "stdin" }),
      prompt: "hello world",
      backendId: "other-cli",
    });
    expect(result).toEqual({ stdin: "hello world" });
  });

  it("falls back to stdin when prompt exceeds maxPromptArgChars", () => {
    const result = resolvePromptInput({
      backend: makeBackend({ maxPromptArgChars: 5 }),
      prompt: "hello world",
      backendId: "other-cli",
    });
    expect(result).toEqual({ stdin: "hello world" });
  });

  it("uses arg when prompt is within maxPromptArgChars", () => {
    const result = resolvePromptInput({
      backend: makeBackend({ maxPromptArgChars: 100 }),
      prompt: "hello",
      backendId: "other-cli",
    });
    expect(result).toEqual({ argsPrompt: "hello" });
  });

  it("handles long prompts for claude-cli via stdin (avoids ENAMETOOLONG)", () => {
    const longPrompt = "x".repeat(10000);
    const result = resolvePromptInput({
      backend: makeBackend(),
      prompt: longPrompt,
      backendId: "claude-cli",
    });
    expect(result).toEqual({ stdin: longPrompt });
  });
});
