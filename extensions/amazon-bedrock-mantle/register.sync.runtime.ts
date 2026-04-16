import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import {
  mergeImplicitMantleProvider,
  resolveImplicitMantleProvider,
  resolveMantleBearerToken,
} from "./discovery.js";

export function registerBedrockMantlePlugin(api: OpenClawPluginApi): void {
  const providerId = "amazon-bedrock-mantle";

  api.registerProvider({
    id: providerId,
    label: "Amazon Bedrock Mantle (OpenAI-compatible)",
    docsPath: "/providers/bedrock-mantle",
    auth: [],
    catalog: {
      order: "simple",
      run: async (ctx) => {
        const pluginConfig = (api.pluginConfig ?? {}) as { discovery?: { enabled?: boolean } };
        const implicit = await resolveImplicitMantleProvider({
          env: ctx.env,
          discoveryConfig: pluginConfig.discovery,
        });
        if (!implicit) {
          return null;
        }
        return {
          provider: mergeImplicitMantleProvider({
            existing: ctx.config.models?.providers?.[providerId],
            implicit,
          }),
        };
      },
    },
    resolveConfigApiKey: ({ env }) =>
      resolveMantleBearerToken(env) ? "AWS_BEARER_TOKEN_BEDROCK" : undefined,
    matchesContextOverflowError: ({ errorMessage }) =>
      /context_length_exceeded|max.*tokens.*exceeded/i.test(errorMessage),
    classifyFailoverReason: ({ errorMessage }) => {
      if (/rate_limit|too many requests|429/i.test(errorMessage)) {
        return "rate_limit";
      }
      if (/overloaded|503/i.test(errorMessage)) {
        return "overloaded";
      }
      return undefined;
    },
  });
}
