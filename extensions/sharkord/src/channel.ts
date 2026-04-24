import { createChatChannelPlugin } from "openclaw/plugin-sdk/channel-core";
import type { ChannelPlugin } from "openclaw/plugin-sdk/channel-core";
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-runtime";
import { SharkordChannelConfigSchema } from "./config-schema.js";
import { startSharkordGateway } from "./gateway.js";
import { normalizeBridgeEvent, buildInboundTarget } from "./inbound.js";
import { normalizeSharkordMessagingTarget } from "./normalize.js";
import { sharkordOutboundBaseAdapter } from "./outbound-base.js";
import { secretTargetRegistryEntries, collectRuntimeConfigAssignments } from "./secret-contract.js";
import { sendTextToSharkord } from "./send.js";
import type { CoreConfig, SharkordProbe } from "./types.js";

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
  blurb: "Self-hosted Sharkord chat via bridge plugin.",
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

export const sharkordPlugin: ChannelPlugin<ResolvedSharkordAccount, SharkordProbe> =
  createChatChannelPlugin({
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
          typeof env?.SHARKORD_BRIDGE_URL === "string" && env.SHARKORD_BRIDGE_URL.trim().length > 0,
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
          if (!sharkordCfg?.bridgeUrl) {
            throw new Error("Sharkord bridgeUrl is required");
          }

          const bridgeUrl = sharkordCfg.bridgeUrl;
          const bridgeSecret = sharkordCfg.bridgeSecret;
          const listenPort = sharkordCfg.listenPort ?? 4994;
          const accountId = ctx.accountId ?? "default";

          ctx.log?.info?.(`sharkord: starting gateway on port ${listenPort}`);

          const handle = startSharkordGateway(
            { listenPort, bridgeSecret },
            {
              onMessage: async (event) => {
                const msg = normalizeBridgeEvent(event);
                const target = buildInboundTarget(msg, accountId);
                ctx.log?.info?.(
                  `sharkord: inbound from ${msg.userId ?? "unknown"} in channel ${msg.channelId}`,
                );

                if (ctx.channelRuntime) {
                  const ctxPayload = ctx.channelRuntime.reply.finalizeInboundContext({
                    Body: msg.text,
                    BodyForAgent: msg.text,
                    RawBody: msg.text,
                    CommandBody: msg.text,
                    From: msg.userId ?? "unknown",
                    To: `sharkord:${accountId}`,
                    SessionKey: target,
                    AccountId: accountId,
                    ChatType: msg.isGroup ? "group" : "direct",
                    SenderId: msg.userId ?? "unknown",
                    SenderName: msg.userName ?? "Unknown",
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
                          await sendTextToSharkord(target, text, {
                            bridgeUrl,
                            bridgeSecret,
                            accountId,
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
              onConnected: () => {
                ctx.log?.info?.(`sharkord: gateway connected (port=${listenPort})`);
              },
              log: (msg) => ctx.log?.info?.(msg),
            },
            { abortSignal: ctx.abortSignal },
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
        sendText: async ({ to, text, accountId, replyToId }) => {
          // TODO: resolve bridgeUrl/secret from runtime config
          const bridgeUrl = process.env.SHARKORD_BRIDGE_URL ?? "http://localhost:4993";
          const bridgeSecret = process.env.SHARKORD_BRIDGE_SECRET;
          const result = await sendTextToSharkord(to, text, {
            bridgeUrl,
            bridgeSecret,
            accountId: accountId ?? undefined,
            replyTo: replyToId ?? undefined,
          });
          return { messageId: result.messageId, target: result.target };
        },
        sendMedia: async ({ to, text, mediaUrl, accountId, replyToId }) => {
          // For now, send media as text with link
          const bridgeUrl = process.env.SHARKORD_BRIDGE_URL ?? "http://localhost:4993";
          const bridgeSecret = process.env.SHARKORD_BRIDGE_SECRET;
          const message = mediaUrl ? (text ? `${text}\n${mediaUrl}` : mediaUrl) : (text ?? "");
          const result = await sendTextToSharkord(to, message, {
            bridgeUrl,
            bridgeSecret,
            accountId: accountId ?? undefined,
            replyTo: replyToId ?? undefined,
          });
          return { messageId: result.messageId, target: result.target };
        },
      },
    },
  });
