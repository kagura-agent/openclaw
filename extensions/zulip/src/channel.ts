import { createChatChannelPlugin } from "openclaw/plugin-sdk/channel-core";
import type { ChannelPlugin } from "openclaw/plugin-sdk/channel-core";
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-runtime";
import { ZulipChannelConfigSchema } from "./config-schema.js";
import { secretTargetRegistryEntries, collectRuntimeConfigAssignments } from "./secret-contract.js";
import type { ZulipProbe } from "./types.js";

type ResolvedZulipAccount = {
  accountId?: string | null;
  realm: string;
  email: string;
  configured: boolean;
};

const meta = {
  id: "zulip",
  label: "Zulip",
  selectionLabel: "Zulip (Realm + Bot)",
  docsPath: "/channels/zulip",
  docsLabel: "zulip",
  blurb: "Zulip team chat with stream/topic routing and DM support.",
  order: 90,
  detailLabel: "Zulip",
  systemImage: "bubble.left.and.bubble.right",
};

function resolveZulipAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedZulipAccount {
  const zulip = (params.cfg as Record<string, unknown>).channels as
    | Record<string, unknown>
    | undefined;
  const zulipCfg = zulip?.zulip as Record<string, unknown> | undefined;
  const realm = (zulipCfg?.realm as string) ?? "";
  const email = (zulipCfg?.email as string) ?? "";
  return {
    accountId: params.accountId ?? null,
    realm,
    email,
    configured: realm.length > 0 && email.length > 0,
  };
}

export const zulipPlugin: ChannelPlugin<ResolvedZulipAccount, ZulipProbe> = createChatChannelPlugin(
  {
    base: {
      id: "zulip",
      meta,
      capabilities: {
        chatTypes: ["direct", "group"],
        media: true,
        blockStreaming: false,
      },
      reload: { configPrefixes: ["channels.zulip"] },
      configSchema: ZulipChannelConfigSchema,
      config: {
        listAccountIds: () => [],
        resolveAccount: (cfg, accountId) => resolveZulipAccount({ cfg, accountId }),
        hasConfiguredState: ({ env }) =>
          typeof env?.ZULIP_REALM === "string" &&
          env.ZULIP_REALM.trim().length > 0 &&
          typeof env?.ZULIP_EMAIL === "string" &&
          env.ZULIP_EMAIL.trim().length > 0 &&
          typeof env?.ZULIP_API_KEY === "string" &&
          env.ZULIP_API_KEY.trim().length > 0,
        isConfigured: (account) => account.configured,
      },
      secrets: {
        secretTargetRegistryEntries,
        collectRuntimeConfigAssignments,
      },
    },
    // TODO: gateway, inbound, outbound adapters
  },
);
