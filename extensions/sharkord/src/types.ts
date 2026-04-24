// Sharkord bridge event & request types

import type {
  BaseProbeResult,
  OpenClawConfig,
  DmPolicy,
  BlockStreamingCoalesceConfig,
  MarkdownConfig,
} from "./runtime-api.js";

// ─── Bridge Payloads ───

/** Event forwarded from Sharkord bridge plugin to OpenClaw */
export interface BridgeEvent {
  type: "message:created" | "message:updated" | "message:deleted";
  messageId: string;
  channelId: number;
  userId: string | null;
  userName?: string;
  content: string; // plain text
  htmlContent: string; // HTML
  timestamp: number;
  parentMessageId?: string;
  replyToMessageId?: string;
}

/** Request to send a message via bridge plugin */
export interface BridgeSendRequest {
  channelId: number;
  content: string; // HTML
  replyTo?: string;
  parentMessageId?: string;
}

/** Response from bridge /send endpoint */
export interface BridgeSendResponse {
  messageId: string;
}

// ─── Adapter Config ───

export type SharkordAccountConfig = {
  name?: string;
  enabled?: boolean;
  bridgeUrl?: string;
  bridgeSecret?: string;
  listenPort?: number;
  dmPolicy?: DmPolicy;
  allowFrom?: Array<string | number>;
  markdown?: MarkdownConfig;
  blockStreaming?: boolean;
  blockStreamingCoalesce?: BlockStreamingCoalesceConfig;
};

export type SharkordConfig = SharkordAccountConfig & {
  accounts?: Record<string, SharkordAccountConfig>;
  defaultAccount?: string;
};

export type CoreConfig = OpenClawConfig & {
  channels?: OpenClawConfig["channels"] & {
    sharkord?: SharkordConfig;
  };
};

// ─── Inbound Message ───

export type SharkordInboundMessage = {
  messageId: string;
  channelId: number;
  userId: string | null;
  userName?: string;
  text: string;
  htmlContent: string;
  timestamp: number;
  isGroup: boolean;
  parentMessageId?: string;
  replyToMessageId?: string;
};

// ─── Probe ───

export type SharkordProbe = BaseProbeResult<string> & {
  bridgeUrl: string;
  latencyMs?: number;
};
