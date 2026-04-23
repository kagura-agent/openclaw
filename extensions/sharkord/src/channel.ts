import { createChatChannelPlugin } from "openclaw/plugin-sdk/channel-core";
import type { ChannelPlugin } from "openclaw/plugin-sdk/channel-core";
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-runtime";
import { SharkordChannelConfigSchema } from "./config-schema.js";
import { startSharkordGateway } from "./gateway.js";
import { normalizeBridgeEvent, buildInboundTarget } from "./inbound.js";
import { normalizeSharkordMessagingTarget } from "./normalize.js";
import { sharkordOutboundBaseAdapter } from "./outbound-base.js";
import { secretTargetRegistryEntries, collectRuntimeConfigAssignments } from "./secret-contract.js";
import { sendMessageSharkord, setDefaultBridge } from "./send.js";
import type { CoreConfig } from "./types.js";

const DEFAULT_LISTEN_PORT = 19400;

type ResolvedSharkordAccount = {
  accountId?: string | null;
  bridgeUrl: string;
  configured: boolean;
};

const meta = {
  id: "sharkord",
  label: "Sharkord",
  selectionLabel: "Sharkord (Bridge)",
  docsPath: "/channels/sharkord",
  docsLabel: "sharkord",
  blurb: "Self-hosted Sharkord chat via HTTP bridge plugin.",
  order: 95,
  detailLabel: "Sharkord",
  systemImage: "bubble.left.and.bubble.right",
};

function resolveSharkordAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedSharkordAccount {
  const channels = (params.cfg as Record<string, unknown>).channels as
    | Record<string, unknown>
    | undefined;
  const sharkordCfg = channels?.sharkord as Record<string, unknown> | undefined;
  const bridgeUrl = (sharkordCfg?.bridgeUrl as string) ?? "";
  return {
    accountId: params.accountId ?? null,
    bridgeUrl,
    configured: bridgeUrl.length > 0,
  };
}

export const sharkordPlugin: ChannelPlugin<ResolvedSharkordAccount> = createChatChannelPlugin({
  base: {
    id: "sharkord",
    meta,
    capabilities: {
      chatTypes: ["direct", "group"],
      media: true,
      blockStreaming: false,
    },
    reload: { configPrefixes: ["channels.sharkord"] },
    configSchema: SharkordChannelConfigSchema,
    config: {
      listAccountIds: () => [],
      resolveAccount: (cfg, accountId) => resolveSharkordAccount({ cfg, accountId }),
      hasConfiguredState: ({ env }) =>
        typeof env?.SHARKORD_BRIDGE_URL === "string" &&
        env.SHARKORD_BRIDGE_URL.trim().length > 0 &&
        typeof env?.SHARKORD_BRIDGE_SECRET === "string" &&
        env.SHARKORD_BRIDGE_SECRET.trim().length > 0,
      isConfigured: (account) => account.configured,
    },
    secrets: {
      secretTargetRegistryEntries,
      collectRuntimeConfigAssignments,
    },
    messaging: {
      normalizeTarget: normalizeSharkordMessagingTarget,
    },
    gateway: {
      startAccount: async (ctx) => {
        const cfg = ctx.cfg as CoreConfig;
        const sharkordCfg = cfg.channels?.sharkord;
        if (!sharkordCfg?.bridgeUrl || !sharkordCfg?.bridgeSecret) {
          throw new Error("Sharkord bridgeUrl and bridgeSecret are required");
        }

        const bridgeUrl = sharkordCfg.bridgeUrl;
        const bridgeSecret = sharkordCfg.bridgeSecret;
        const listenPort = sharkordCfg.listenPort ?? DEFAULT_LISTEN_PORT;

        ctx.log?.info?.(`sharkord: starting gateway on port ${listenPort}`);

        // Set default bridge for send module
        setDefaultBridge({ bridgeUrl, bridgeSecret });

        const handle = await startSharkordGateway(
          { listenPort, bridgeSecret, abortSignal: ctx.abortSignal },
          {
            onMessage: async (event) => {
              const msg = normalizeBridgeEvent(event);
              const target = buildInboundTarget(msg);

              ctx.log?.info?.(`sharkord: inbound from ${msg.userId} → ${target}`);

              if (ctx.channelRuntime) {
                const ctxPayload = ctx.channelRuntime.reply.finalizeInboundContext({
                  Body: msg.text,
                  BodyForAgent: msg.text,
                  RawBody: msg.text,
                  CommandBody: msg.text,
                  From: msg.userId,
                  To: "sharkord",
                  SessionKey: target,
                  AccountId: "default",
                  ChatType: msg.isGroup ? "group" : "direct",
                  SenderId: msg.userId,
                  SenderName: msg.userId,
                  Provider: "sharkord",
                  Surface: "sharkord",
                  MessageSid: msg.messageId,
                  Timestamp: msg.timestamp,
                  OriginatingChannel: "sharkord",
                  OriginatingTo: target,
                  CommandAuthorized: false,
                });

                await ctx.channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
                  ctx: ctxPayload,
                  cfg: ctx.cfg,
                  dispatcherOptions: {
                    deliver: async (payload: { text?: string }) => {
                      const text = payload.text?.trim();
                      if (text) {
                        await sendMessageSharkord(target, text, {
                          bridge: { bridgeUrl, bridgeSecret },
                        });
                      }
                    },
                  },
                });
              }
            },
            onError: (err) => {
              ctx.log?.info?.(`sharkord: gateway error: ${String(err)}`);
            },
            log: (msg) => ctx.log?.info?.(msg),
          },
        );

        return {
          stop: async () => {
            await handle.stop();
            ctx.log?.info?.("sharkord: gateway stopped");
          },
        };
      },
    },
  },
  outbound: {
    base: sharkordOutboundBaseAdapter,
    attachedResults: {
      channel: "sharkord",
      sendText: async ({ to, text, replyToId }) => {
        const result = await sendMessageSharkord(to, text, {
          replyTo: replyToId ?? undefined,
        });
        return { messageId: result.messageId, target: result.target };
      },
      sendMedia: async ({ to, text, mediaUrl, replyToId }) => {
        // Sharkord bridge accepts HTML content; embed media as link
        const message = mediaUrl
          ? text
            ? `${text}\n<a href="${mediaUrl}">${mediaUrl}</a>`
            : `<a href="${mediaUrl}">${mediaUrl}</a>`
          : text;
        const result = await sendMessageSharkord(to, message, {
          replyTo: replyToId ?? undefined,
        });
        return { messageId: result.messageId, target: result.target };
      },
    },
  },
});
