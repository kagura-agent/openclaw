import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { applyProviderAuthConfigPatch } from "./provider-auth-choice-helpers.js";

describe("applyProviderAuthConfigPatch", () => {
  it("merges patched default model maps with existing models", () => {
    const base = {
      agents: {
        defaults: {
          model: {
            primary: "anthropic/claude-sonnet-4-6",
            fallbacks: ["anthropic/claude-opus-4-6", "openai/gpt-5.2"],
          },
          models: {
            "anthropic/claude-sonnet-4-6": { alias: "Sonnet" },
            "anthropic/claude-opus-4-6": { alias: "Opus" },
            "openai/gpt-5.2": {},
          },
        },
      },
    };
    const patch = {
      agents: {
        defaults: {
          models: {
            "claude-cli/claude-sonnet-4-6": { alias: "Sonnet" },
            "claude-cli/claude-opus-4-6": { alias: "Opus" },
          },
        },
      },
    };

    const next = applyProviderAuthConfigPatch(base, patch);

    expect(next.agents?.defaults?.models).toEqual({
      "anthropic/claude-sonnet-4-6": { alias: "Sonnet" },
      "anthropic/claude-opus-4-6": { alias: "Opus" },
      "openai/gpt-5.2": {},
      "claude-cli/claude-sonnet-4-6": { alias: "Sonnet" },
      "claude-cli/claude-opus-4-6": { alias: "Opus" },
    });
    expect(next.agents?.defaults?.model).toEqual(base.agents?.defaults?.model);
  });

  it("merges models from a second provider without losing the first provider's models", () => {
    const afterFirstProvider = {
      agents: {
        defaults: {
          models: {
            "anthropic/claude-sonnet-4-6": { alias: "Sonnet" },
            "anthropic/claude-opus-4-6": { alias: "Opus" },
          },
        },
      },
    };
    const secondProviderPatch = {
      agents: {
        defaults: {
          models: {
            "openai/gpt-5.4": { alias: "GPT-5.4" },
            "openai/gpt-5.2": {},
          },
        },
      },
    };

    const next = applyProviderAuthConfigPatch(afterFirstProvider, secondProviderPatch);

    expect(next.agents?.defaults?.models).toEqual({
      "anthropic/claude-sonnet-4-6": { alias: "Sonnet" },
      "anthropic/claude-opus-4-6": { alias: "Opus" },
      "openai/gpt-5.4": { alias: "GPT-5.4" },
      "openai/gpt-5.2": {},
    });
  });

  it("lets patch override existing model entry when keys collide", () => {
    const base = {
      agents: {
        defaults: {
          models: {
            "openai/gpt-5.2": { alias: "Old" },
          },
        },
      },
    };
    const patch = {
      agents: {
        defaults: {
          models: {
            "openai/gpt-5.2": { alias: "New" },
          },
        },
      },
    };

    const next = applyProviderAuthConfigPatch(base, patch);

    expect(next.agents?.defaults?.models).toEqual({
      "openai/gpt-5.2": { alias: "New" },
    });
  });

  it("keeps normal recursive merges for unrelated provider auth patch fields", () => {
    const base = {
      agents: {
        defaults: {
          contextPruning: {
            mode: "cache-ttl",
            ttl: "30m",
          },
        },
      },
    } satisfies OpenClawConfig;
    const patch = {
      agents: {
        defaults: {
          contextPruning: {
            ttl: "1h",
          },
        },
      },
    };

    const next = applyProviderAuthConfigPatch(base, patch);

    expect(next).toEqual({
      agents: {
        defaults: {
          contextPruning: {
            mode: "cache-ttl",
            ttl: "1h",
          },
        },
      },
    });
  });
});
